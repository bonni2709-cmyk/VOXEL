import { contextBridge, ipcRenderer } from 'electron';
import { EVENTS, IPC } from '../shared/ipc';
import type {
  AccountView, CrashFinding, DependencyFinding, GalleryItem, ModHit, ScriptToggle, ServerStatus, SkinEntry, WorldInfo,
} from '../shared/types';
import type {
  AppInfo, InstallProgress, IpcResult, LaunchExit, LaunchOptions, LogLine,
  OfflineProfile, SystemInfo, VersionSummary,
} from '../shared/types';

/** Подписка только на разрешённые события main → renderer. */
function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const api = {
  appInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.appInfo),
  systemInfo: (): Promise<SystemInfo> => ipcRenderer.invoke(IPC.systemInfo),
  profile: {
    get: (): Promise<OfflineProfile> => ipcRenderer.invoke(IPC.profileGet),
    setName: (name: string): Promise<IpcResult<OfflineProfile>> =>
      ipcRenderer.invoke(IPC.profileSetName, name),
  },
  versions: {
    list: (): Promise<IpcResult<VersionSummary[]>> => ipcRenderer.invoke(IPC.versionsList),
    installed: (): Promise<string[]> => ipcRenderer.invoke(IPC.versionsInstalled),
  },
  install: {
    start: (id: string): Promise<IpcResult<null>> => ipcRenderer.invoke(IPC.installStart, id),
    cancel: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.installCancel, id),
  },
  launch: {
    start: (opts: LaunchOptions): Promise<IpcResult<{ pid: number }>> => ipcRenderer.invoke(IPC.launchStart, opts),
    stop: (): Promise<boolean> => ipcRenderer.invoke(IPC.launchStop),
    running: (): Promise<boolean> => ipcRenderer.invoke('launch:running'),
  },
  java: {
    status: (): Promise<number[]> => ipcRenderer.invoke(IPC.javaStatus),
    install: (major: number): Promise<IpcResult<string>> => ipcRenderer.invoke(IPC.javaInstall, major),
  },
  fabric: {
    install: (mc: string): Promise<IpcResult<string>> => ipcRenderer.invoke(IPC.fabricInstall, mc),
  },
  worlds: {
    list: (id: string): Promise<IpcResult<WorldInfo[]>> => ipcRenderer.invoke(IPC.worldsList, id),
    backup: (id: string, world: string): Promise<IpcResult<string>> => ipcRenderer.invoke(IPC.worldsBackup, id, world),
  },
  gallery: {
    list: (id: string): Promise<IpcResult<GalleryItem[]>> => ipcRenderer.invoke(IPC.galleryList, id),
  },
  mods: {
    search: (q: string, gameVersion: string): Promise<IpcResult<ModHit[]>> => ipcRenderer.invoke(IPC.modsSearch, q, gameVersion),
    install: (id: string, projectId: string): Promise<IpcResult<string>> => ipcRenderer.invoke(IPC.modsInstall, id, projectId),
    list: (id: string): Promise<IpcResult<string[]>> => ipcRenderer.invoke(IPC.modsList, id),
  },
  crash: {
    analyze: (lines: string[]): Promise<CrashFinding[]> => ipcRenderer.invoke(IPC.crashAnalyze, lines),
  },
  auth: {
    status: (): Promise<AccountView> => ipcRenderer.invoke(IPC.authStatus),
    signIn: (clientId: string): Promise<IpcResult<AccountView>> => ipcRenderer.invoke(IPC.authSignIn, clientId),
    signOut: (): Promise<IpcResult<null>> => ipcRenderer.invoke(IPC.authSignOut),
  },
  server: {
    status: (): Promise<ServerStatus> => ipcRenderer.invoke(IPC.serverStatus),
    install: (type: string, mc: string): Promise<IpcResult<null>> => ipcRenderer.invoke(IPC.serverInstall, type, mc),
    configure: (patch: Partial<Pick<ServerStatus, 'port' | 'motd' | 'onlineMode'>> & { backup?: ServerStatus['backup'] }): Promise<IpcResult<null>> =>
      ipcRenderer.invoke(IPC.serverConfigure, patch),
    start: (ramMb: number, javaPath: string): Promise<IpcResult<null>> => ipcRenderer.invoke(IPC.serverStart, ramMb, javaPath),
    stop: (): Promise<boolean> => ipcRenderer.invoke(IPC.serverStop),
    command: (cmd: string): Promise<boolean> => ipcRenderer.invoke(IPC.serverCommand, cmd),
  },
  pack: {
    exportZip: (id: string, includeScripts: boolean): Promise<IpcResult<string>> => ipcRenderer.invoke(IPC.packExportZip, id, includeScripts),
    exportMrpack: (id: string, includeScripts: boolean): Promise<IpcResult<string>> => ipcRenderer.invoke(IPC.packExportMrpack, id, includeScripts),
    import: (id: string): Promise<IpcResult<string>> => ipcRenderer.invoke(IPC.packImport, id),
  },
  scripts: {
    list: (id: string): Promise<IpcResult<ScriptToggle[]>> => ipcRenderer.invoke(IPC.scriptsList, id),
    set: (id: string, dir: string, enabled: boolean): Promise<IpcResult<null>> => ipcRenderer.invoke(IPC.scriptsSet, id, dir, enabled),
  },
  deps: {
    resolve: (id: string): Promise<IpcResult<DependencyFinding[]>> => ipcRenderer.invoke(IPC.depsResolve, id),
  },
  skins: {
    list: (): Promise<SkinEntry[]> => ipcRenderer.invoke(IPC.skinsList),
    save: (name: string, dataUrl: string): Promise<IpcResult<string>> => ipcRenderer.invoke(IPC.skinsSave, name, dataUrl),
    import: (name: string): Promise<IpcResult<string>> => ipcRenderer.invoke(IPC.skinsImport, name),
    remove: (name: string): Promise<IpcResult<null>> => ipcRenderer.invoke(IPC.skinsDelete, name),
  },
  on: {
    serverLog: (cb: (l: LogLine) => void) => subscribe(EVENTS.serverLog, cb),
    serverExit: (cb: (e: { code: number | null }) => void) => subscribe(EVENTS.serverExit, cb),
    packProgress: (cb: (p: { done: number; total: number; name: string }) => void) => subscribe(EVENTS.packProgress, cb),
    installProgress: (cb: (p: InstallProgress) => void) => subscribe(EVENTS.installProgress, cb),
    launchLog: (cb: (l: LogLine) => void) => subscribe(EVENTS.launchLog, cb),
    launchExit: (cb: (e: LaunchExit) => void) => subscribe(EVENTS.launchExit, cb),
  },
};

contextBridge.exposeInMainWorld('voxel', api);

export type VoxelApi = typeof api;
