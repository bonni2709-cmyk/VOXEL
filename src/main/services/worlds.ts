import { createWriteStream, promises as fs } from 'node:fs';
import { join, relative, sep } from 'node:path';
import yazl from 'yazl';
import type { WorldInfo } from '../../shared/types';

export async function listWorlds(saves: string): Promise<WorldInfo[]> {
  let entries: import('node:fs').Dirent[] = [];
  try {
    entries = await fs.readdir(saves, { withFileTypes: true });
  } catch {
    return [];
  }
  const worlds: WorldInfo[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = join(saves, e.name);
    try {
      const st = await fs.stat(join(dir, 'level.dat'));
      const size = await dirSize(dir);
      worlds.push({ name: e.name, sizeBytes: size, lastPlayed: st.mtimeMs });
    } catch {
      // не мир: нет level.dat
    }
  }
  return worlds.sort((a, b) => b.lastPlayed - a.lastPlayed);
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  for (const f of await walk(dir)) total += (await fs.stat(f)).size;
  return total;
}

/** ZIP-бэкап мира. Вызывать только когда игра не запущена (проверяет вызывающий код). */
export async function backupWorld(saves: string, backups: string, world: string): Promise<string> {
  const src = join(saves, world);
  await fs.access(join(src, 'level.dat'));
  await fs.mkdir(backups, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = join(backups, `${world}-${stamp}.zip`);

  const zip = new yazl.ZipFile();
  for (const file of await walk(src)) {
    const rel = relative(src, file).split(sep).join('/');
    zip.addFile(file, `${world}/${rel}`);
  }
  zip.end();
  await new Promise<void>((resolve, reject) => {
    const ws = createWriteStream(out);
    zip.outputStream.pipe(ws);
    ws.on('close', () => resolve());
    ws.on('error', reject);
  });
  return out;
}
