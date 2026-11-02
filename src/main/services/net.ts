import { getShieldConfig, HEADER_TIMEOUT_MS, shieldFetch } from './netshield';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/** Хосты официальных серверов Mojang. Всё остальное не скачиваем. */
export const MOJANG_HOSTS = [
  'piston-meta.mojang.com',
  'piston-data.mojang.com',
  'launchermeta.mojang.com',
  'libraries.minecraft.net',
  'resources.download.minecraft.net',
] as const;

export interface NetOptions {
  hosts: readonly string[];
  allowHttp?: boolean;
  timeoutMs?: number;
}

export function assertAllowedUrl(url: string, opts: NetOptions): URL {
  const u = new URL(url);
  const httpOk = opts.allowHttp && u.protocol === 'http:';
  if (u.protocol !== 'https:' && !httpOk) throw new Error(`Небезопасный протокол: ${u.protocol}`);
  if (!opts.hosts.includes(u.hostname)) throw new Error(`Хост не в списке разрешённых: ${u.hostname}`);
  return u;
}

/** Относительный путь внутри корня: без `..`, абсолютных путей и бэкслешей. */
export function safeRelativePath(p: string): string {
  if (!p || isAbsolute(p) || p.includes('\\') || /^[a-zA-Z]:/.test(p)) {
    throw new Error(`Небезопасный путь: ${p}`);
  }
  const parts = p.split('/');
  if (parts.some((s) => s === '' || s === '.' || s === '..')) throw new Error(`Небезопасный путь: ${p}`);
  return parts.join('/');
}

export function resolveInside(root: string, rel: string): string {
  const full = resolve(root, safeRelativePath(rel));
  const base = resolve(root);
  if (!full.startsWith(base + sep)) throw new Error(`Путь вне каталога: ${rel}`);
  return full;
}

export async function hashFile(path: string, algo: 'sha1' | 'sha256'): Promise<string> {
  const hash = createHash(algo);
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

export const sha1File = (path: string) => hashFile(path, 'sha1');

export interface VerifiedFile {
  url: string;
  path: string;
  sha1?: string;
  sha256?: string;
  size?: number;
}

async function fileMatches(f: VerifiedFile): Promise<boolean> {
  try {
    const st = await fs.stat(f.path);
    if (f.size !== undefined && st.size !== f.size) return false;
    if (f.sha1 !== undefined && (await hashFile(f.path, 'sha1')) !== f.sha1.toLowerCase()) return false;
    if (f.sha256 !== undefined && (await hashFile(f.path, 'sha256')) !== f.sha256.toLowerCase()) return false;
    return true;
  } catch {
    return false;
  }
}

function combine(signal: AbortSignal | undefined, timeoutMs = 30_000): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export async function fetchJson<T>(url: string, opts: NetOptions, signal?: AbortSignal): Promise<T> {
  assertAllowedUrl(url, opts);
  const { response: res } = await shieldFetch(url, getShieldConfig(), {}, HEADER_TIMEOUT_MS, combine(signal, opts.timeoutMs));
  if (!res.ok) throw new Error(`HTTP ${res.status} для ${url}`);
  return (await res.json()) as T;
}

/**
 * Скачивает во временный `.part-UUID`, проверяет размер и SHA-1/SHA-256,
 * затем атомарно переименовывает. Корректный существующий файл пропускается.
 */
export async function downloadVerified(
  file: VerifiedFile,
  opts: NetOptions,
  signal?: AbortSignal,
): Promise<'cached' | 'downloaded'> {
  assertAllowedUrl(file.url, opts);
  if (await fileMatches(file)) return 'cached';

  await fs.mkdir(dirname(file.path), { recursive: true });
  const { response: res } = await shieldFetch(file.url, getShieldConfig(), {}, HEADER_TIMEOUT_MS, combine(signal, opts.timeoutMs));
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} для ${file.url}`);

  const tmp = `${file.path}.part-${randomUUID()}`;
  const h1 = createHash('sha1');
  const h256 = createHash('sha256');
  let bytes = 0;
  const body = Readable.fromWeb(res.body as never);
  body.on('data', (chunk: Buffer) => {
    h1.update(chunk);
    h256.update(chunk);
    bytes += chunk.length;
  });
  try {
    await pipeline(body, createWriteStream(tmp));
    if (file.size !== undefined && bytes !== file.size) {
      throw new Error(`Размер не совпал: ${file.path} (${bytes} вместо ${file.size})`);
    }
    if (file.sha1 !== undefined && h1.digest('hex') !== file.sha1.toLowerCase()) {
      throw new Error(`SHA-1 не совпал: ${file.path}`);
    }
    if (file.sha256 !== undefined && h256.digest('hex') !== file.sha256.toLowerCase()) {
      throw new Error(`SHA-256 не совпал: ${file.path}`);
    }
    await fs.rename(tmp, file.path);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
  return 'downloaded';
}

/** Ограниченный параллельный пул; при ошибке остальные задачи останавливаются. */
export async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  const internal = new AbortController();
  const stop = () => internal.abort();
  signal?.addEventListener('abort', stop, { once: true });
  let next = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (!internal.signal.aborted) {
      const index = next++;
      if (index >= items.length) return;
      try {
        await worker(items[index] as T);
      } catch (err) {
        internal.abort();
        throw err;
      }
    }
  });

  try {
    await Promise.all(runners);
    if (signal?.aborted) throw new Error('Операция отменена');
  } finally {
    signal?.removeEventListener('abort', stop);
  }
}

export function toRelative(root: string, full: string): string {
  return relative(root, full).split(sep).join('/');
}
