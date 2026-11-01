import { createWriteStream, promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';
import { resolveInside } from './net';

export function openZip(path: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true, autoClose: true }, (err, zip) => {
      if (err || !zip) reject(err ?? new Error('Не удалось открыть архив'));
      else resolve(zip);
    });
  });
}

/** Читает один файл из архива как текст; null, если файла нет. */
export async function readZipText(path: string, name: string): Promise<string | null> {
  const zip = await openZip(path);
  return new Promise<string | null>((resolve, reject) => {
    let found: string | null = null;
    zip.on('error', reject);
    zip.on('entry', (entry: yauzl.Entry) => {
      if (entry.fileName !== name) return zip.readEntry();
      zip.openReadStream(entry, (err, stream) => {
        if (err || !stream) return reject(err ?? new Error('read failed'));
        const chunks: Buffer[] = [];
        stream.on('data', (c: Buffer) => chunks.push(c));
        stream.on('end', () => {
          found = Buffer.concat(chunks).toString('utf8');
          zip.close();
          resolve(found);
        });
        stream.on('error', reject);
      });
    });
    zip.on('end', () => resolve(found));
    zip.readEntry();
  });
}

/** Список имён всех записей архива. */
export async function listZipEntries(path: string): Promise<string[]> {
  const zip = await openZip(path);
  return new Promise<string[]>((resolve, reject) => {
    const names: string[] = [];
    zip.on('error', reject);
    zip.on('entry', (entry: yauzl.Entry) => {
      names.push(entry.fileName);
      zip.readEntry();
    });
    zip.on('end', () => resolve(names));
    zip.readEntry();
  });
}

/**
 * Извлекает записи с префиксом `prefix` в `destRoot` (префикс снимается).
 * Каждый путь проходит проверку resolveInside — защита от zip-slip.
 */
export async function extractPrefix(path: string, prefix: string, destRoot: string): Promise<number> {
  const zip = await openZip(path);
  let count = 0;
  await new Promise<void>((resolve, reject) => {
    zip.on('error', reject);
    zip.on('entry', (entry: yauzl.Entry) => {
      if (!entry.fileName.startsWith(prefix) || entry.fileName.endsWith('/')) return zip.readEntry();
      const rel = entry.fileName.slice(prefix.length);
      let dest: string;
      try {
        dest = resolveInside(destRoot, rel);
      } catch {
        return reject(new Error(`Небезопасный путь в архиве: ${entry.fileName}`));
      }
      zip.openReadStream(entry, (err, stream) => {
        if (err || !stream) return reject(err ?? new Error('read failed'));
        void fs.mkdir(dirname(dest), { recursive: true })
          .then(() => pipeline(stream, createWriteStream(dest)))
          .then(() => { count++; zip.readEntry(); })
          .catch(reject);
      });
    });
    zip.on('end', () => resolve());
    zip.readEntry();
  });
  return count;
}
