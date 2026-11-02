import { promises as fs } from 'node:fs';
import { join } from 'node:path';

export interface RegionInfo {
  file: string;
  regionX: number;
  regionZ: number;
  chunks: number;
  sizeBytes: number;
}

/** Считает сгенерированные чанки по заголовку .mca: 1024 записи по 4 байта (смещение 3 Б + размер 1 Б). */
export function parseRegionHeader(header: Buffer): number {
  if (header.length < 4096) return 0;
  let chunks = 0;
  for (let i = 0; i < 1024; i++) {
    const off = header.readUIntBE(i * 4, 3);
    if (off !== 0 && header[i * 4 + 3] !== 0) chunks++;
  }
  return chunks;
}

/** Имя региона вида r.X.Z.mca → координаты; иначе null. */
export function regionCoords(name: string): { x: number; z: number } | null {
  const m = /^r\.(-?\d+)\.(-?\d+)\.mca$/.exec(name);
  return m ? { x: Number(m[1]), z: Number(m[2]) } : null;
}

/**
 * Сводка по регионам мира. Отсутствие папки region (ENOENT) — не ошибка:
 * мир без сгенерированной территории возвращает пустой список.
 */
export async function mapOverview(worldDir: string): Promise<RegionInfo[]> {
  const dir = join(worldDir, 'region');
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const out: RegionInfo[] = [];
  for (const name of names) {
    const c = regionCoords(name);
    if (!c) continue;
    const full = join(dir, name);
    const fh = await fs.open(full, 'r');
    try {
      const st = await fh.stat();
      const header = Buffer.alloc(4096);
      await fh.read(header, 0, 4096, 0);
      out.push({ file: name, regionX: c.x, regionZ: c.z, chunks: parseRegionHeader(header), sizeBytes: st.size });
    } finally {
      await fh.close();
    }
  }
  return out.sort((a, b) => a.regionX - b.regionX || a.regionZ - b.regionZ);
}
