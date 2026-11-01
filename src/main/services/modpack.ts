import { createWriteStream, promises as fs } from 'node:fs';
import { join, relative, sep } from 'node:path';
import yazl from 'yazl';
import { extractPrefix, readZipText } from './zip';
import { downloadVerified, resolveInside, type NetOptions } from './net';

/** Папки, которые никогда не попадают в экспорт. */
const ALWAYS_EXCLUDED = new Set(['logs', 'crash-reports', 'backups', 'screenshots', '.fabric']);
/** Скрипты: KubeJS и CraftTweaker. Исключаются, если пользователь выключил их в экспорте. */
export const SCRIPT_DIRS = ['kubejs', 'scripts'] as const;

async function walk(dir: string, base: string, skipTop: Set<string>): Promise<string[]> {
  const out: string[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (dir === base && skipTop.has(e.name)) continue;
    if (e.isDirectory()) out.push(...(await walk(full, base, skipTop)));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

export interface ExportOptions {
  includeScripts: boolean;
}

function toZipName(base: string, file: string): string {
  return relative(base, file).split(sep).join('/');
}

async function writeZip(zip: yazl.ZipFile, out: string): Promise<void> {
  zip.end();
  await new Promise<void>((resolve, reject) => {
    const ws = createWriteStream(out);
    zip.outputStream.pipe(ws).on('finish', () => resolve()).on('error', reject);
  });
}

/** Обычный ZIP сборки (папка игры целиком, без логов/бэкапов/скриншотов). */
export async function exportZip(instanceDir: string, outFile: string, opts: ExportOptions): Promise<number> {
  const skip = new Set(ALWAYS_EXCLUDED);
  if (!opts.includeScripts) for (const d of SCRIPT_DIRS) skip.add(d);
  const files = await walk(instanceDir, instanceDir, skip);
  const zip = new yazl.ZipFile();
  for (const f of files) zip.addFile(f, toZipName(instanceDir, f));
  await fs.mkdir(join(outFile, '..'), { recursive: true });
  await writeZip(zip, outFile);
  return files.length;
}

export interface MrpackMeta {
  name: string;
  versionId: string;
  gameVersion: string;
  loaderVersion?: string;
}

/** .mrpack (формат Modrinth): modrinth.index.json + overrides/. Моды кладутся в overrides. */
export async function exportMrpack(instanceDir: string, outFile: string, meta: MrpackMeta, opts: ExportOptions): Promise<number> {
  const skip = new Set(ALWAYS_EXCLUDED);
  if (!opts.includeScripts) for (const d of SCRIPT_DIRS) skip.add(d);
  const files = await walk(instanceDir, instanceDir, skip);
  const deps: Record<string, string> = { minecraft: meta.gameVersion };
  if (meta.loaderVersion) deps['fabric-loader'] = meta.loaderVersion;
  const index = {
    formatVersion: 1,
    game: 'minecraft',
    versionId: meta.versionId,
    name: meta.name,
    files: [] as unknown[],
    dependencies: deps,
  };
  const zip = new yazl.ZipFile();
  zip.addBuffer(Buffer.from(JSON.stringify(index, null, 2), 'utf8'), 'modrinth.index.json');
  for (const f of files) zip.addFile(f, `overrides/${toZipName(instanceDir, f)}`);
  await fs.mkdir(join(outFile, '..'), { recursive: true });
  await writeZip(zip, outFile);
  return files.length;
}

export interface MrpackIndex {
  name: string;
  versionId: string;
  dependencies: Record<string, string>;
  files: { path: string; downloads: string[]; hashes: { sha1?: string; sha512?: string }; fileSize?: number; env?: { client?: string } }[];
}

const MODRINTH_CDN = ['cdn.modrinth.com'] as const;

/** Разбирает и проверяет индекс .mrpack. Бросает ошибку при небезопасных данных. */
export async function readMrpackIndex(file: string): Promise<MrpackIndex> {
  const text = await readZipText(file, 'modrinth.index.json');
  if (!text) throw new Error('В архиве нет modrinth.index.json — это не .mrpack');
  const idx = JSON.parse(text) as MrpackIndex;
  if (typeof idx.name !== 'string' || typeof idx.dependencies?.minecraft !== 'string') {
    throw new Error('Некорректный modrinth.index.json');
  }
  for (const f of idx.files ?? []) {
    resolveInside('/x', f.path); // путь файла внутри игры
    for (const d of f.downloads ?? []) {
      const host = new URL(d).hostname;
      if (!MODRINTH_CDN.includes(host as (typeof MODRINTH_CDN)[number])) throw new Error(`Недоверенный хост: ${host}`);
    }
  }
  return { ...idx, files: idx.files ?? [] };
}

/**
 * Импорт .mrpack: скачивает файлы из индекса (с проверкой SHA-1 и размера),
 * затем распаковывает overrides/ в папку сборки.
 */
export async function importMrpack(
  file: string,
  instanceDir: string,
  net: NetOptions,
  onProgress: (done: number, total: number) => void,
): Promise<{ files: number; overrides: number }> {
  const idx = await readMrpackIndex(file);
  await fs.mkdir(instanceDir, { recursive: true });
  let done = 0;
  for (const f of idx.files) {
    if (f.env?.client === 'unsupported') { done++; continue; }
    await downloadVerified(
      { url: f.downloads[0], path: resolveInside(instanceDir, f.path), sha1: f.hashes.sha1, size: f.fileSize },
      net,
    );
    done++;
    onProgress(done, idx.files.length);
  }
  const overrides = await extractPrefix(file, 'overrides/', instanceDir);
  return { files: idx.files.length, overrides };
}

export interface ScriptState {
  dir: string;
  enabled: boolean;
  present: boolean;
}

/** Состояние скриптов: `kubejs` включён, а `kubejs.disabled` — выключен. */
export async function scriptState(instanceDir: string): Promise<ScriptState[]> {
  const out: ScriptState[] = [];
  for (const d of SCRIPT_DIRS) {
    const on = await fs.stat(join(instanceDir, d)).then((s) => s.isDirectory(), () => false);
    const off = await fs.stat(join(instanceDir, `${d}.disabled`)).then((s) => s.isDirectory(), () => false);
    out.push({ dir: d, enabled: on, present: on || off });
  }
  return out;
}

export async function setScriptEnabled(instanceDir: string, dir: string, enabled: boolean): Promise<void> {
  if (!(SCRIPT_DIRS as readonly string[]).includes(dir)) throw new Error('Неизвестная папка скриптов');
  const on = join(instanceDir, dir);
  const off = join(instanceDir, `${dir}.disabled`);
  if (enabled) {
    await fs.rename(off, on).catch(() => undefined);
  } else {
    await fs.rename(on, off).catch(() => undefined);
  }
}
