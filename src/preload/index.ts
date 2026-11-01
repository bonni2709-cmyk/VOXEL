import { contextBridge } from 'electron';
import type { AppInfo } from '../shared/types';

const api = {
  appInfo: (): AppInfo => ({
    name: 'VOXEL',
    version: '4.0.0',
    platform: process.platform,
  }),
};

contextBridge.exposeInMainWorld('voxel', api);

export type VoxelApi = typeof api;
