/// <reference types="vite/client" />
import type { VoxelApi } from '../../preload/index';

declare global {
  interface Window {
    voxel: VoxelApi;
  }
}
