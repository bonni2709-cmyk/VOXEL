import { app } from 'electron';
import { join } from 'node:path';

export { dataPaths, versionDir, nativesDir } from './layout';
export type { DataPaths } from './layout';

/** Корень данных: VOXEL_DATA_DIR или %APPDATA%/VOXEL/minecraft. */
export function dataRoot(): string {
  return process.env['VOXEL_DATA_DIR'] ?? join(app.getPath('appData'), 'VOXEL', 'minecraft');
}
