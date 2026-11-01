import { app } from 'electron';
import { join } from 'node:path';

/** Корень данных: VOXEL_DATA_DIR или %APPDATA%/VOXEL/minecraft. */
export function dataRoot(): string {
  return process.env['VOXEL_DATA_DIR'] ?? join(app.getPath('appData'), 'VOXEL', 'minecraft');
}

export interface DataPaths {
  root: string;
  libraries: string;
  assets: string;
  versions: string;
  instances: string;
}

export function dataPaths(root: string): DataPaths {
  return {
    root,
    libraries: join(root, 'libraries'),
    assets: join(root, 'assets'),
    versions: join(root, 'versions'),
    instances: join(root, 'instances'),
  };
}

export function versionDir(p: DataPaths, id: string): string {
  return join(p.versions, id);
}

export function nativesDir(p: DataPaths, id: string): string {
  return join(versionDir(p, id), 'natives');
}
