import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import type { AppInfo, IpcResult, OfflineProfile, SystemInfo } from '../shared/types';

const api = {
  appInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.appInfo),
  systemInfo: (): Promise<SystemInfo> => ipcRenderer.invoke(IPC.systemInfo),
  profile: {
    get: (): Promise<OfflineProfile> => ipcRenderer.invoke(IPC.profileGet),
    setName: (name: string): Promise<IpcResult<OfflineProfile>> =>
      ipcRenderer.invoke(IPC.profileSetName, name),
  },
};

contextBridge.exposeInMainWorld('voxel', api);

export type VoxelApi = typeof api;
