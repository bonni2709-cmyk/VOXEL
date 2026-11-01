import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import type { InstallProgress } from '../../shared/types';
import { mavenPath } from './libraries';
import { installVersion, type EmitFn } from './installer';
import { fetchJson, downloadVerified, runPool, type NetOptions } from './net';
import { versionDir, type DataPaths } from './paths';
import type { RuleContext } from './rules';
import type { VersionJson } from './mojang';

export const FABRIC_NET: NetOptions = { hosts: ['meta.fabricmc.net', 'maven.fabricmc.net'] };

interface FabricLibrary {
  name: string;
  url?: string;
  sha1?: string;
  size?: number;
}

/** Fabric Loader: профиль версии + библиотеки (inheritsFrom → vanilla). */
export async function installFabric(
  mc: string,
  paths: DataPaths,
  ctx: RuleContext,
  emit: EmitFn,
  signal?: AbortSignal,
): Promise<string> {
  const loaders = await fetchJson<{ version: string; stable: boolean }[]>(
    'https://meta.fabricmc.net/v2/versions/loader',
    FABRIC_NET,
    signal,
  );
  const loader = loaders.find((l) => l.stable)?.version;
  if (!loader) throw new Error('Fabric Loader: стабильная версия не найдена');

  const profile = await fetchJson<Omit<VersionJson, 'libraries'> & { id: string; libraries: FabricLibrary[] }>(
    `https://meta.fabricmc.net/v2/versions/loader/${mc}/${loader}/profile/json`,
    FABRIC_NET,
    signal,
  );

  await installVersion(mc, paths, ctx, emit, signal);

  const id = profile.id;
  const dir = versionDir(paths, id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(join(dir, `${id}.json`), JSON.stringify(profile, null, 2), 'utf8');

  const libs = profile.libraries.map((l) => ({
    path: mavenPath(l.name),
    url: (l.url ?? 'https://maven.fabricmc.net/') + mavenPath(l.name),
    sha1: l.sha1,
    size: l.size,
  }));
  let done = 0;
  emit({ versionId: id, stage: 'libraries', done: 0, total: libs.length } satisfies InstallProgress);
  await runPool(libs, 8, async (l) => {
    await downloadVerified({ url: l.url, path: join(paths.libraries, l.path), sha1: l.sha1, size: l.size }, FABRIC_NET, signal);
    emit({ versionId: id, stage: 'libraries', done: ++done, total: libs.length });
  }, signal);

  return id;
}
