import { contextBridge, ipcRenderer } from 'electron';
import { EVENTS, IPC } from '../shared/ipc';
import type { CrashFinding, GalleryItem, ModHit, WorldInfo } from '../shared/types';
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
  on: {
    installProgress: (cb: (p: InstallProgress) => void) => subscribe(EVENTS.installProgress, cb),
    launchLog: (cb: (l: LogLine) => void) => subscribe(EVENTS.launchLog, cb),
    launchExit: (cb: (e: LaunchExit) => void) => subscribe(EVENTS.launchExit, cb),
  },
};

contextBridge.exposeInMainWorld('voxel', api);

export type VoxelApi = typeof api;
