import { createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';
import { resolveInside } from './net';

function openZip(path: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true, autoClose: true }, (err, zip) => {
      if (err || !zip) reject(err ?? new Error('Не удалось открыть архив'));
      else resolve(zip);
    });
  });
}

/**
 * Распаковывает нативные библиотеки в каталог natives.
 * Пути проверяются на выход за пределы каталога (zip-slip).
 */
export async function extractNatives(
  jarPath: string,
  destDir: string,
  exclude: string[],
): Promise<number> {
  const zip = await openZip(jarPath);
  let count = 0;

  await new Promise<void>((resolve, reject) => {
    zip.on('error', reject);
    zip.on('end', resolve);
    zip.on('entry', (entry: yauzl.Entry) => {
      const name = entry.fileName;
      const skip = name.endsWith('/') || exclude.some((ex) => name.startsWith(ex));
      if (skip) {
        zip.readEntry();
        return;
      }
      const target = resolveInside(destDir, name);
      zip.openReadStream(entry, (err, stream) => {
        if (err || !stream) return reject(err ?? new Error('Ошибка чтения архива'));
        fs.mkdir(dirname(target), { recursive: true })
          .then(() => pipeline(stream, createWriteStream(target)))
          .then(() => {
            count++;
            zip.readEntry();
          })
          .catch(reject);
      });
    });
    zip.readEntry();
  });

  return count;
}
