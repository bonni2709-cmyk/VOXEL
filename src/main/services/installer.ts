import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { InstallProgress } from '../../shared/types';
import { assetObjectUrl, fetchManifest, type AssetIndex, type VersionJson, NET } from './mojang';
import { resolveLibraries } from './libraries';
import { extractNatives } from './natives';
import { nativesDir, versionDir, type DataPaths } from './paths';
import { downloadVerified, runPool } from './net';
import type { RuleContext } from './rules';

export type EmitFn = (p: InstallProgress) => void;

const LIB_CONCURRENCY = 12;
const ASSET_CONCURRENCY = 12;

/**
 * Установка ванильной версии: version JSON → client.jar → библиотеки →
 * natives → asset index → объекты ассетов. Каждый файл проверяется по SHA-1.
 */
export async function installVersion(
  id: string,
  paths: DataPaths,
  ctx: RuleContext,
  emit: EmitFn,
  signal?: AbortSignal,
): Promise<VersionJson> {
  const report = (stage: InstallProgress['stage'], done: number, total: number) =>
    emit({ versionId: id, stage, done, total });

  report('manifest', 0, 1);
  const manifest = await fetchManifest(signal);
  const entry = manifest.find((e) => e.id === id);
  if (!entry) throw new Error(`Версия ${id} не найдена в манифесте`);

  const dir = versionDir(paths, id);
  const vjPath = join(dir, `${id}.json`);
  await downloadVerified({ url: entry.url, path: vjPath, sha1: entry.sha1 }, NET, signal);
  const vj = JSON.parse(await fs.readFile(vjPath, 'utf8')) as VersionJson;

  // 1. client.jar
  const client = vj.downloads?.client;
  if (!client) throw new Error('В манифесте нет client.jar');
  report('client', 0, 1);
  await downloadVerified(
    { url: client.url, path: join(dir, `${id}.jar`), sha1: client.sha1, size: client.size },
    NET,
    signal,
  );
  report('client', 1, 1);

  // 2. библиотеки
  const libs = resolveLibraries(vj.libraries, ctx);
  let libDone = 0;
  report('libraries', 0, libs.artifacts.length);
  await runPool(
    libs.artifacts,
    LIB_CONCURRENCY,
    async (a) => {
      await downloadVerified(
        { url: a.url, path: join(paths.libraries, a.path), sha1: a.sha1, size: a.size },
        NET,
        signal,
      );
      report('libraries', ++libDone, libs.artifacts.length);
    },
    signal,
  );

  // 3. natives: скачиваем jar и распаковываем в versions/<id>/natives
  const natDir = nativesDir(paths, id);
  await fs.rm(natDir, { recursive: true, force: true });
  await fs.mkdir(natDir, { recursive: true });
  let natDone = 0;
  report('natives', 0, libs.natives.length);
  for (const n of libs.natives) {
    const jar = join(paths.libraries, n.path);
    await downloadVerified({ url: n.url, path: jar, sha1: n.sha1, size: n.size }, NET, signal);
    await extractNatives(jar, natDir, n.exclude);
    report('natives', ++natDone, libs.natives.length);
  }

  // 4. asset index и объекты
  if (vj.assetIndex) {
    const idx = vj.assetIndex;
    const indexPath = join(paths.assets, 'indexes', `${idx.id}.json`);
    await downloadVerified({ url: idx.url, path: indexPath, sha1: idx.sha1, size: idx.size }, NET, signal);
    const index = JSON.parse(await fs.readFile(indexPath, 'utf8')) as AssetIndex;
    const hashes = [...new Set(Object.values(index.objects).map((o) => o.hash))];
    const sizes = new Map(Object.values(index.objects).map((o) => [o.hash, o.size] as const));
    let assetDone = 0;
    report('assets', 0, hashes.length);
    await runPool(
      hashes,
      ASSET_CONCURRENCY,
      async (hash) => {
        await downloadVerified(
          {
            url: assetObjectUrl(hash),
            path: join(paths.assets, 'objects', hash.slice(0, 2), hash),
            sha1: hash,
            size: sizes.get(hash),
          },
          NET,
          signal,
        );
        report('assets', ++assetDone, hashes.length);
      },
      signal,
    );
  }

  report('done', 1, 1);
  return vj;
}
