import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { GalleryItem } from '../../shared/types';

const MAX_ITEMS = 60;
const MAX_BYTES = 4 * 1024 * 1024;

/** Скриншоты из screenshots/, новые первыми. Превью — data URL (CSP запрещает file://). */
export async function listScreenshots(dir: string): Promise<GalleryItem[]> {
  let names: string[] = [];
  try {
    names = (await fs.readdir(dir)).filter((n) => /\.png$/i.test(n));
  } catch {
    return [];
  }
  const withTime = await Promise.all(
    names.map(async (name) => ({ name, mtime: (await fs.stat(join(dir, name))).mtimeMs })),
  );
  withTime.sort((a, b) => b.mtime - a.mtime);
  const items: GalleryItem[] = [];
  for (const { name } of withTime.slice(0, MAX_ITEMS)) {
    const path = join(dir, name);
    const st = await fs.stat(path);
    if (st.size > MAX_BYTES) continue;
    const data = await fs.readFile(path);
    items.push({ name, dataUrl: `data:image/png;base64,${data.toString('base64')}` });
  }
  return items;
}
