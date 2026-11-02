import { app, BrowserWindow, ipcMain } from 'electron';
import { promises as fs } from 'node:fs';
import { totalmem } from 'node:os';
import { join } from 'node:path';
import { EVENTS, IPC } from '../shared/ipc';
import type {
  AppInfo, InstallProgress, IpcResult, LaunchExit, LaunchOptions, LogLine,
  OfflineProfile, SystemInfo, VersionSummary,
} from '../shared/types';
import { getProfile, setProfileName } from './services/profile';
import { fetchManifest, toSummary } from './services/mojang';
import { installVersion } from './services/installer';
import { dataPaths, dataRoot, versionDir } from './services/paths';
import { currentOs, type RuleContext } from './services/rules';
import { instanceDir, isRunning, startGame, stopGame } from './services/launch';
import { installJava, javaStatus } from './services/java';
import { installFabric } from './services/fabric';
import { loadVersion } from './services/version-chain';
import { backupWorld, listWorlds } from './services/worlds';
import { listScreenshots } from './services/gallery';
import { installMod, listInstalledMods, searchMods } from './services/modrinth';
import { analyzeCrash } from './services/crash';
import type { CrashFinding, GalleryItem, ModHit, WorldInfo } from '../shared/types';
import { existsSync } from 'node:fs';
import { registerExtraIpc } from './ipc/extra';
import { registerV5Ipc } from './ipc/v5';
import { connectDiscord, setPlaying, clearPlaying } from './services/discord';
import { getSecret } from './services/secrets';
import { loadSession } from './services/msauth-flow';

const installs = new Map<string, AbortController>();

function send(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, payload);
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0F1115',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));
}

function ruleContext(features: Record<string, boolean> = {}): RuleContext {
  return { osName: currentOs(process.platform), arch: process.arch, features };
}

async function listInstalled(): Promise<string[]> {
  const paths = dataPaths(dataRoot());
  let entries: string[] = [];
  try {
    entries = await fs.readdir(paths.versions);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const id of entries) {
    if (!existsSync(join(versionDir(paths, id), `${id}.json`))) continue;
    try {
      const { jarId } = await loadVersion(paths, id);
      if (existsSync(join(versionDir(paths, jarId), `${jarId}.jar`))) out.push(id);
    } catch {
      // битый JSON — версия не считается установленной
    }
  }
  return out;
}

function registerIpc(): void {
  registerExtraIpc({ send });
  registerV5Ipc();
  ipcMain.handle(IPC.appInfo, (): AppInfo => ({
    name: 'VOXEL',
    version: app.getVersion(),
    platform: process.platform,
  }));

  ipcMain.handle(IPC.systemInfo, (): SystemInfo => ({
    totalMemoryMb: Math.floor(totalmem() / 1024 / 1024),
  }));

  ipcMain.handle(IPC.profileGet, (): Promise<OfflineProfile> => getProfile());
  ipcMain.handle(IPC.profileSetName, (_e, name: unknown): Promise<IpcResult<OfflineProfile>> =>
    typeof name === 'string' ? setProfileName(name) : Promise.resolve({ ok: false, error: 'Некорректное имя.' }),
  );

  ipcMain.handle(IPC.versionsList, async (): Promise<IpcResult<VersionSummary[]>> => {
    try {
      return { ok: true, data: (await fetchManifest()).map(toSummary) };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC.versionsInstalled, async (): Promise<string[]> => listInstalled());

  ipcMain.handle(IPC.installStart, async (_e, id: unknown): Promise<IpcResult<null>> => {
    if (typeof id !== 'string' || !/^[\w.-]{1,64}$/.test(id)) return { ok: false, error: 'Некорректная версия.' };
    if (installs.has(id)) return { ok: false, error: 'Установка уже идёт.' };
    const controller = new AbortController();
    installs.set(id, controller);
    const emit = (p: InstallProgress) => send(EVENTS.installProgress, p);
    try {
      const paths = dataPaths(dataRoot());
      await fs.mkdir(paths.root, { recursive: true });
      await installVersion(id, paths, ruleContext({ has_custom_resolution: true }), emit, controller.signal);
      return { ok: true, data: null };
    } catch (err) {
      const message = controller.signal.aborted ? 'Установка отменена.' : (err as Error).message;
      emit({ versionId: id, stage: 'error', done: 0, total: 0, error: message });
      return { ok: false, error: message };
    } finally {
      installs.delete(id);
    }
  });

  ipcMain.handle(IPC.installCancel, (_e, id: unknown): boolean => {
    const controller = typeof id === 'string' ? installs.get(id) : undefined;
    controller?.abort();
    return Boolean(controller);
  });

  ipcMain.handle(IPC.launchStart, async (_e, opts: LaunchOptions): Promise<IpcResult<{ pid: number }>> => {
    try {
      const ms = await loadSession(dataRoot());
      const profile = ms
        ? { name: ms.name, uuid: ms.uuid, accessToken: ms.accessToken }
        : await getProfile();
      const paths = dataPaths(dataRoot());
      const pid = await startGame(
        opts,
        profile,
        paths,
        ruleContext({ has_custom_resolution: true }),
        (line: LogLine) => send(EVENTS.launchLog, line),
        (exit: LaunchExit, findings: CrashFinding[]) => {
          void clearPlaying();
          send(EVENTS.launchExit, { ...exit, findings });
        },
      );
      const appId = await getSecret(dataRoot(), 'discordAppId');
      if (appId && (await connectDiscord(appId))) void setPlaying(`Minecraft ${opts.versionId}`, `Игрок: ${profile.name}`);
      return { ok: true, data: { pid } };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC.launchStop, (): boolean => stopGame());

  const guard = <T>(fn: () => Promise<T>): Promise<IpcResult<T>> =>
    fn().then((data) => ({ ok: true, data }), (err: Error) => ({ ok: false, error: err.message }));
  const idOk = (v: unknown): v is string => typeof v === 'string' && /^[\w.-]{1,64}$/.test(v);

  ipcMain.handle(IPC.javaStatus, (): Promise<number[]> => javaStatus(dataPaths(dataRoot())));
  ipcMain.handle(IPC.javaInstall, (_e, major: unknown) =>
    guard(async () => {
      if (typeof major !== 'number') throw new Error('Некорректная версия Java');
      await fs.mkdir(dataRoot(), { recursive: true });
      return installJava(major, dataPaths(dataRoot()));
    }),
  );

  ipcMain.handle(IPC.fabricInstall, (_e, mc: unknown) =>
    guard(async () => {
      if (!idOk(mc)) throw new Error('Некорректная версия игры');
      const emit = (p: InstallProgress) => send(EVENTS.installProgress, p);
      return installFabric(mc, dataPaths(dataRoot()), ruleContext({ has_custom_resolution: true }), emit);
    }),
  );

  ipcMain.handle(IPC.worldsList, (_e, id: unknown) =>
    guard<WorldInfo[]>(async () => {
      if (!idOk(id)) throw new Error('Некорректная версия');
      return listWorlds(join(instanceDir(dataPaths(dataRoot()), id), 'saves'));
    }),
  );

  ipcMain.handle(IPC.worldsBackup, (_e, id: unknown, world: unknown) =>
    guard(async () => {
      if (!idOk(id) || typeof world !== 'string' || world.includes('/') || world.includes('\\') || world === '..') {
        throw new Error('Некорректный мир');
      }
      if (isRunning()) throw new Error('Во время игры операции с миром заблокированы');
      const paths = dataPaths(dataRoot());
      const inst = instanceDir(paths, id);
      return backupWorld(join(inst, 'saves'), join(inst, 'backups'), world);
    }),
  );

  ipcMain.handle(IPC.galleryList, (_e, id: unknown) =>
    guard<GalleryItem[]>(async () => {
      if (!idOk(id)) throw new Error('Некорректная версия');
      return listScreenshots(join(instanceDir(dataPaths(dataRoot()), id), 'screenshots'));
    }),
  );

  ipcMain.handle(IPC.modsSearch, (_e, q: unknown, gv: unknown) =>
    guard<ModHit[]>(async () => {
      if (typeof q !== 'string' || !idOk(gv)) throw new Error('Некорректный запрос');
      return searchMods(q.slice(0, 100), gv);
    }),
  );

  ipcMain.handle(IPC.modsInstall, (_e, id: unknown, projectId: unknown) =>
    guard(async () => {
      if (!idOk(id) || typeof projectId !== 'string' || !/^[\w-]{1,64}$/.test(projectId)) throw new Error('Некорректный мод');
      const modsDir = join(instanceDir(dataPaths(dataRoot()), id), 'mods');
      return installMod(projectId, id, modsDir);
    }),
  );

  ipcMain.handle(IPC.modsList, (_e, id: unknown) =>
    guard<string[]>(async () => {
      if (!idOk(id)) throw new Error('Некорректная версия');
      return listInstalledMods(join(instanceDir(dataPaths(dataRoot()), id), 'mods'));
    }),
  );

  ipcMain.handle(IPC.crashAnalyze, (_e, lines: unknown): CrashFinding[] =>
    Array.isArray(lines) ? analyzeCrash(lines.filter((l): l is string => typeof l === 'string').slice(-2000)) : [],
  );
  ipcMain.handle('launch:running', (): boolean => isRunning());
}

void app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

