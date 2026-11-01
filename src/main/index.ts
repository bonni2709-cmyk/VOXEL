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
import { isRunning, startGame, stopGame } from './services/launch';
import { existsSync } from 'node:fs';

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
  return entries.filter((id) =>
    existsSync(join(versionDir(paths, id), `${id}.json`)) &&
    existsSync(join(versionDir(paths, id), `${id}.jar`)),
  );
}

function registerIpc(): void {
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
      const profile = await getProfile();
      const paths = dataPaths(dataRoot());
      const pid = await startGame(
        opts,
        profile,
        paths,
        ruleContext({ has_custom_resolution: true }),
        (line: LogLine) => send(EVENTS.launchLog, line),
        (exit: LaunchExit) => send(EVENTS.launchExit, exit),
      );
      return { ok: true, data: { pid } };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC.launchStop, (): boolean => stopGame());
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

