import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { VersionJson } from './mojang';
import { versionDir, type DataPaths } from './layout';

export interface LoadedVersion {
  /** Объединённый version JSON (child поверх parent). */
  vj: VersionJson;
  /** Id версии, из которой берётся client.jar и natives (vanilla для Fabric). */
  jarId: string;
}

interface ChildVersionJson extends VersionJson {
  inheritsFrom?: string;
}

/** Объединяет child с parent: библиотеки и аргументы складываются, child имеет приоритет. */
export function mergeVersion(parent: VersionJson, child: ChildVersionJson): VersionJson {
  const args = parent.arguments || child.arguments
    ? {
        game: [...(parent.arguments?.game ?? []), ...(child.arguments?.game ?? [])],
        jvm: [...(parent.arguments?.jvm ?? []), ...(child.arguments?.jvm ?? [])],
      }
    : undefined;
  return {
    ...parent,
    ...child,
    libraries: [...child.libraries, ...parent.libraries],
    arguments: args,
    minecraftArguments: child.minecraftArguments ?? parent.minecraftArguments,
    assetIndex: child.assetIndex ?? parent.assetIndex,
    downloads: child.downloads ?? parent.downloads,
    javaVersion: child.javaVersion ?? parent.javaVersion,
  };
}

/** Читает version JSON и рекурсивно подмешивает inheritsFrom (глубина до 4). */
export async function loadVersion(paths: DataPaths, id: string, depth = 0): Promise<LoadedVersion> {
  if (depth > 4) throw new Error('Слишком глубокая цепочка inheritsFrom');
  const raw = await fs.readFile(join(versionDir(paths, id), `${id}.json`), 'utf8');
  const child = JSON.parse(raw) as ChildVersionJson;
  if (!child.inheritsFrom) return { vj: child, jarId: id };
  const parent = await loadVersion(paths, child.inheritsFrom, depth + 1);
  return { vj: mergeVersion(parent.vj, child), jarId: parent.jarId };
}
