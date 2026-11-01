import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { readZipText } from './zip';
import { satisfies } from './mcversion';

export interface FabricModMeta {
  file: string;
  id: string;
  version: string;
  depends: Record<string, string>;
  conflicts: Record<string, string>;
}

export interface ResolverFinding {
  kind: 'missing' | 'version' | 'conflict' | 'minecraft' | 'unknown-range';
  mod: string;
  message: string;
}

/** Читает fabric.mod.json из jar. Jar без метаданных (например, Forge) — null. */
export async function readFabricMod(jarPath: string): Promise<FabricModMeta | null> {
  let text: string | null = null;
  try {
    text = await readZipText(jarPath, 'fabric.mod.json');
  } catch {
    return null;
  }
  if (!text) return null;
  try {
    const j = JSON.parse(text) as {
      id?: unknown; version?: unknown; depends?: Record<string, string>; conflicts?: Record<string, string>;
    };
    if (typeof j.id !== 'string') return null;
    return {
      file: jarPath,
      id: j.id,
      version: typeof j.version === 'string' ? j.version : '0',
      depends: j.depends ?? {},
      conflicts: j.conflicts ?? {},
    };
  } catch {
    return null;
  }
}

export async function readModsDir(modsDir: string): Promise<FabricModMeta[]> {
  let names: string[] = [];
  try {
    names = await fs.readdir(modsDir);
  } catch {
    return [];
  }
  const out: FabricModMeta[] = [];
  for (const n of names.filter((x) => x.endsWith('.jar'))) {
    const meta = await readFabricMod(join(modsDir, n));
    if (meta) out.push(meta);
  }
  return out;
}

const IGNORED = new Set(['fabricloader', 'java', 'fabric-api-base']);

/** Проверяет зависимости и конфликты установленных модов относительно версии игры. */
export function resolveDependencies(mods: FabricModMeta[], gameVersion: string): ResolverFinding[] {
  const byId = new Map(mods.map((m) => [m.id, m]));
  const findings: ResolverFinding[] = [];

  const check = (owner: string, depId: string, range: string, conflict: boolean) => {
    if (depId === 'minecraft') {
      const ok = satisfies(gameVersion, range);
      if (ok === null) findings.push({ kind: 'unknown-range', mod: owner, message: `Диапазон ${range} не распознан — проверьте вручную` });
      else if (!ok) findings.push({ kind: 'minecraft', mod: owner, message: `Требует Minecraft ${range}, а выбрана ${gameVersion}` });
      return;
    }
    if (IGNORED.has(depId)) return;
    const dep = byId.get(depId);
    if (conflict) {
      if (!dep) return;
      const ok = satisfies(dep.version, range);
      if (ok !== false) findings.push({ kind: 'conflict', mod: owner, message: `Конфликтует с ${depId} ${range}` });
      return;
    }
    if (!dep) {
      findings.push({ kind: 'missing', mod: owner, message: `Не установлена зависимость ${depId} ${range}` });
      return;
    }
    const ok = satisfies(dep.version, range);
    if (ok === null) findings.push({ kind: 'unknown-range', mod: owner, message: `Версия ${depId} ${dep.version} или диапазон ${range} не распознаны` });
    else if (!ok) findings.push({ kind: 'version', mod: owner, message: `${depId} ${dep.version} не подходит под ${range}` });
  };

  for (const mod of mods) {
    for (const [depId, range] of Object.entries(mod.depends)) check(mod.id, depId, range, false);
    for (const [depId, range] of Object.entries(mod.conflicts)) check(mod.id, depId, range, true);
  }
  return findings;
}
