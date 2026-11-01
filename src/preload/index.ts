import { contextBridge, ipcRenderer } from 'electron';
import { EVENTS, IPC } from '../shared/ipc';
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
  on: {
    installProgress: (cb: (p: InstallProgress) => void) => subscribe(EVENTS.installProgress, cb),
    launchLog: (cb: (l: LogLine) => void) => subscribe(EVENTS.launchLog, cb),
    launchExit: (cb: (e: LaunchExit) => void) => subscribe(EVENTS.launchExit, cb),
  },
};

contextBridge.exposeInMainWorld('voxel', api);

export type VoxelApi = typeof api;
