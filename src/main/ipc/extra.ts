import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { promises as fs } from 'node:fs';
import { join, basename } from 'node:path';
import { IPC, EVENTS } from '../../shared/ipc';
import type {
  AccountView, DependencyFinding, IpcResult, LogLine, ScriptToggle, ServerStatus, SkinEntry,
} from '../../shared/types';
import { getProfile } from '../services/profile';
import { dataPaths, dataRoot } from '../services/paths';
import { instanceDir } from '../services/launch';
import { loadVersion } from '../services/version-chain';
import { readModsDir, resolveDependencies } from '../services/modmeta';
import { exportMrpack, exportZip, importMrpack, scriptState, setScriptEnabled, SCRIPT_DIRS } from '../services/modpack';
import { clearSession, loadSession, saveSession, signInMicrosoft } from '../services/msauth-flow';
import {
  BACKUP_INTERVALS, installServerJar, renderServerProperties, sendServerCommand, serverRunning,
  startServer, stopServer, SERVER_TYPES, type BackupInterval, type ServerType,
} from '../services/server';
import { checkSkinPng, skinFileName } from '../services/skin';
import { javaMajorFor } from '../services/mcversion';
import { resolveJava } from '../services/launch';
import { NET } from '../services/mojang';
import { readMrpackIndex } from '../services/modpack';
import { mergeServerProperties } from '../services/server';

export interface ExtraDeps {
  send: (channel: string, payload: unknown) => void;
}

const guard = <T>(fn: () => Promise<T>): Promise<IpcResult<T>> =>
  fn().then((data) => ({ ok: true as const, data }), (err: Error) => ({ ok: false as const, error: err.message }));

const ID_RE = /^[\w.-]{1,64}$/;
const idOk = (v: unknown): v is string => typeof v === 'string' && ID_RE.test(v);

async function saveDialog(opts: Electron.SaveDialogOptions): ReturnType<typeof dialog.showSaveDialog> {
  const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  return w ? dialog.showSaveDialog(w, opts) : dialog.showSaveDialog(opts);
}

async function openDialog(opts: Electron.OpenDialogOptions): ReturnType<typeof dialog.showOpenDialog> {
  const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  return w ? dialog.showOpenDialog(w, opts) : dialog.showOpenDialog(opts);
}

function parentWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

// ---- server config (server.json) ----
interface ServerConfig {
  type: ServerType | null;
  mc: string | null;
  port: number;
  motd: string;
  onlineMode: boolean;
  backup: BackupInterval | 'off';
}

const DEFAULT_SERVER: ServerConfig = { type: null, mc: null, port: 25565, motd: 'VOXEL server', onlineMode: true, backup: 'off' };

function serverDir(): string {
  return join(dataRoot(), 'server');
}

async function readServerConfig(): Promise<ServerConfig> {
  try {
    return { ...DEFAULT_SERVER, ...(JSON.parse(await fs.readFile(join(serverDir(), 'voxel-server.json'), 'utf8')) as Partial<ServerConfig>) };
  } catch {
    return { ...DEFAULT_SERVER };
  }
}

async function writeServerConfig(cfg: ServerConfig): Promise<void> {
  await fs.mkdir(serverDir(), { recursive: true });
  await fs.writeFile(join(serverDir(), 'voxel-server.json'), JSON.stringify(cfg, null, 2), 'utf8');
}

async function serverStatus(): Promise<ServerStatus> {
  const cfg = await readServerConfig();
  const installed = await fs.access(join(serverDir(), 'server.jar')).then(() => true, () => false);
  return {
    installed, running: serverRunning(), type: cfg.type, mc: cfg.mc, port: cfg.port,
    motd: cfg.motd, onlineMode: cfg.onlineMode, backup: cfg.backup,
  };
}

function validPort(p: unknown): p is number {
  return typeof p === 'number' && Number.isInteger(p) && p >= 1024 && p <= 65535;
}

// ---- skins ----
function skinsDir(): string {
  return join(dataRoot(), 'skins');
}

async function listSkins(): Promise<SkinEntry[]> {
  let names: string[] = [];
  try { names = (await fs.readdir(skinsDir())).filter((n) => n.endsWith('.png')); } catch { return []; }
  const out: SkinEntry[] = [];
  for (const n of names) {
    const buf = await fs.readFile(join(skinsDir(), n));
    out.push({ name: n.replace(/\.png$/, ''), dataUrl: `data:image/png;base64,${buf.toString('base64')}` });
  }
  return out;
}

async function saveSkinBuffer(name: string, buf: Buffer): Promise<string> {
  const file = skinFileName(name);
  if (!file) throw new Error('Имя скина: латиница, цифры, «_» и «-», до 32 символов');
  const check = checkSkinPng(buf);
  if (!check.ok) throw new Error(check.error);
  await fs.mkdir(skinsDir(), { recursive: true });
  await fs.writeFile(join(skinsDir(), file), buf);
  return file;
}

export function registerExtraIpc(deps: ExtraDeps): void {
  const paths = () => dataPaths(dataRoot());
  const selectedInstance = (id: unknown): string => {
    if (!idOk(id)) throw new Error('Выберите версию игры');
    return instanceDir(paths(), id);
  };

  // ---- accounts ----
  ipcMain.handle(IPC.authStatus, async (): Promise<AccountView> => {
    const ms = await loadSession(dataRoot());
    if (ms) return { kind: 'microsoft', name: ms.name, uuid: ms.uuid };
    const off = await getProfile();
    return { kind: 'offline', name: off.name, uuid: off.uuid };
  });

  ipcMain.handle(IPC.authSignIn, (_e: IpcMainInvokeEvent, clientId: unknown) =>
    guard(async (): Promise<AccountView> => {
      if (typeof clientId !== 'string' || !/^[\w-]{8,64}$/.test(clientId.trim())) throw new Error('Некорректный Azure Client ID');
      const s = await signInMicrosoft(clientId.trim(), parentWindow());
      await saveSession(dataRoot(), s);
      return { kind: 'microsoft', name: s.name, uuid: s.uuid };
    }),
  );

  ipcMain.handle(IPC.authSignOut, async (): Promise<IpcResult<null>> =>
    guard(async () => { await clearSession(dataRoot()); return null; }),
  );

  // ---- server ----
  ipcMain.handle(IPC.serverStatus, (): Promise<ServerStatus> => serverStatus());

  ipcMain.handle(IPC.serverInstall, (_e, type: unknown, mc: unknown) =>
    guard(async () => {
      if (typeof type !== 'string' || !(SERVER_TYPES as string[]).includes(type)) throw new Error('Этот тип сервера пока не поддерживается');
      if (!idOk(mc)) throw new Error('Некорректная версия');
      await installServerJar(type as ServerType, mc, serverDir());
      await writeServerConfig({ ...(await readServerConfig()), type: type as ServerType, mc });
      await fs.writeFile(join(serverDir(), 'eula.txt'), 'eula=true\n', 'utf8');
      return null;
    }),
  );

  ipcMain.handle(IPC.serverConfigure, (_e, patch: unknown) =>
    guard(async () => {
      const p = patch as Partial<ServerConfig>;
      const cur = await readServerConfig();
      if (p.port !== undefined && !validPort(p.port)) throw new Error('Порт: 1024–65535');
      if (p.motd !== undefined && (typeof p.motd !== 'string' || p.motd.length > 59)) throw new Error('MOTD до 59 символов');
      if (p.backup !== undefined && p.backup !== 'off' && !(p.backup in BACKUP_INTERVALS)) throw new Error('Некорректный интервал бэкапа');
      const next: ServerConfig = {
        ...cur,
        port: p.port ?? cur.port,
        motd: p.motd ?? cur.motd,
        onlineMode: typeof p.onlineMode === 'boolean' ? p.onlineMode : cur.onlineMode,
        backup: p.backup ?? cur.backup,
      };
      await writeServerConfig(next);
      // server.properties: seed не трогаем при повторной настройке (mergeServerProperties делается при записи)
      const propsPath = join(serverDir(), 'server.properties');
      const existing = await fs.readFile(propsPath, 'utf8').catch(() => '');
      await fs.writeFile(propsPath, mergeServerProperties(existing, renderServerProperties({
        port: next.port, motd: next.motd, onlineMode: next.onlineMode,
      })), 'utf8');
      return null;
    }),
  );

  ipcMain.handle(IPC.serverStart, (_e, ramMb: unknown, javaPath: unknown) =>
    guard(async () => {
      const cfg = await readServerConfig();
      if (!cfg.type || !cfg.mc) throw new Error('Сначала установите сервер');
      if (typeof ramMb !== 'number' || ramMb < 512) throw new Error('Некорректная память');
      const javaExe = await resolveJava(typeof javaPath === 'string' ? javaPath : 'auto', javaMajorFor(cfg.mc), paths());
      const send = (channel: string) => (payload: unknown) => deps.send(channel, payload);
      startServer(
        serverDir(), javaExe, ramMb, cfg.backup === 'off' ? null : cfg.backup,
        send(EVENTS.serverLog) as (l: LogLine) => void,
        (code) => send(EVENTS.serverExit)({ code }),
      );
      return null;
    }),
  );

  ipcMain.handle(IPC.serverStop, (): boolean => stopServer());
  ipcMain.handle(IPC.serverCommand, (_e, cmd: unknown): boolean => typeof cmd === 'string' && sendServerCommand(cmd.trim()));

  // ---- modpacks ----
  ipcMain.handle(IPC.packExportZip, (_e, id: unknown, includeScripts: unknown) =>
    guard(async () => {
      const dir = selectedInstance(id);
      const pick = await saveDialog({
        title: 'Экспорт ZIP', defaultPath: `${id}.zip`, filters: [{ name: 'ZIP', extensions: ['zip'] }],
      });
      if (pick.canceled || !pick.filePath) throw new Error('Отменено');
      const n = await exportZip(dir, pick.filePath, { includeScripts: includeScripts === true });
      return `${pick.filePath} (${n} файлов)`;
    }),
  );

  ipcMain.handle(IPC.packExportMrpack, (_e, id: unknown, includeScripts: unknown) =>
    guard(async () => {
      const dir = selectedInstance(id);
      const { jarId } = await loadVersion(paths(), id as string);
      const pick = await saveDialog({
        title: 'Экспорт .mrpack', defaultPath: `${id}.mrpack`, filters: [{ name: 'Modrinth pack', extensions: ['mrpack'] }],
      });
      if (pick.canceled || !pick.filePath) throw new Error('Отменено');
      const n = await exportMrpack(dir, pick.filePath, {
        name: id as string, versionId: '1.0.0', gameVersion: jarId,
        loaderVersion: (id as string).startsWith('fabric-loader-') ? (id as string).split('-')[2] : undefined,
      }, { includeScripts: includeScripts === true });
      return `${pick.filePath} (${n} файлов)`;
    }),
  );

  ipcMain.handle(IPC.packImport, (_e, id: unknown) =>
    guard(async () => {
      const dir = selectedInstance(id);
      const pick = await openDialog({
        title: 'Импорт .mrpack', properties: ['openFile'], filters: [{ name: 'Modrinth pack', extensions: ['mrpack', 'zip'] }],
      });
      if (pick.canceled || !pick.filePaths[0]) throw new Error('Отменено');
      const file = pick.filePaths[0];
      const idx = await readMrpackIndex(file);
      const res = await importMrpack(file, dir, NET, (done, total) =>
        deps.send(EVENTS.packProgress, { done, total, name: basename(file) }));
      return `${idx.name}: файлов ${res.files}, overrides ${res.overrides}`;
    }),
  );

  ipcMain.handle(IPC.scriptsList, (_e, id: unknown) =>
    guard<ScriptToggle[]>(async () => scriptState(selectedInstance(id))),
  );

  ipcMain.handle(IPC.scriptsSet, (_e, id: unknown, dir: unknown, enabled: unknown) =>
    guard(async () => {
      if (typeof dir !== 'string' || typeof enabled !== 'boolean') throw new Error('Некорректные параметры');
      if (!(SCRIPT_DIRS as readonly string[]).includes(dir)) throw new Error('Неизвестная папка скриптов');
      await setScriptEnabled(selectedInstance(id), dir, enabled);
      return null;
    }),
  );

  ipcMain.handle(IPC.depsResolve, (_e, id: unknown) =>
    guard<DependencyFinding[]>(async () => {
      if (!idOk(id)) throw new Error('Выберите версию игры');
      const { jarId } = await loadVersion(paths(), id);
      const mods = await readModsDir(join(instanceDir(paths(), id), 'mods'));
      return resolveDependencies(mods, jarId);
    }),
  );

  // ---- skins ----
  ipcMain.handle(IPC.skinsList, (): Promise<SkinEntry[]> => listSkins());

  ipcMain.handle(IPC.skinsSave, (_e, name: unknown, dataUrl: unknown) =>
    guard(async () => {
      if (typeof name !== 'string' || typeof dataUrl !== 'string') throw new Error('Некорректные данные');
      const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
      if (!m) throw new Error('Ожидается PNG');
      return saveSkinBuffer(name, Buffer.from(m[1], 'base64'));
    }),
  );

  ipcMain.handle(IPC.skinsImport, (_e, name: unknown) =>
    guard(async () => {
      const pick = await openDialog({
        title: 'Импорт скина', properties: ['openFile'], filters: [{ name: 'PNG', extensions: ['png'] }],
      });
      if (pick.canceled || !pick.filePaths[0]) throw new Error('Отменено');
      const buf = await fs.readFile(pick.filePaths[0]);
      const base = typeof name === 'string' && name ? name : basename(pick.filePaths[0], '.png').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32);
      return saveSkinBuffer(base || 'skin', buf);
    }),
  );

  ipcMain.handle(IPC.skinsDelete, (_e, name: unknown) =>
    guard(async () => {
      const file = typeof name === 'string' ? skinFileName(name) : null;
      if (!file) throw new Error('Некорректное имя');
      await fs.unlink(join(skinsDir(), file));
      return null;
    }),
  );

}
