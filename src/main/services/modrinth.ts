import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { ModHit } from '../../shared/types';
import { fetchJson, downloadVerified, type NetOptions } from './net';

export const MODRINTH_NET: NetOptions = { hosts: ['api.modrinth.com', 'cdn.modrinth.com'] };
const API = 'https://api.modrinth.com/v2';

interface SearchResponse {
  hits: { project_id: string; slug: string; title: string; description: string; downloads: number; icon_url: string | null }[];
}

interface ModVersion {
  id: string;
  files: { url: string; filename: string; size: number; primary: boolean; hashes: { sha1: string } }[];
}

export async function searchMods(query: string, gameVersion: string, signal?: AbortSignal): Promise<ModHit[]> {
  const facets = JSON.stringify([['project_type:mod'], ['categories:fabric'], [`versions:${gameVersion}`]]);
  const url = `${API}/search?query=${encodeURIComponent(query)}&facets=${encodeURIComponent(facets)}&limit=20`;
  const data = await fetchJson<SearchResponse>(url, MODRINTH_NET, signal);
  return data.hits.map((h) => ({
    projectId: h.project_id,
    slug: h.slug,
    title: h.title,
    description: h.description,
    downloads: h.downloads,
    iconUrl: h.icon_url,
  }));
}

/** Устанавливает последнюю совместимую версию (Fabric + нужная версия игры) с проверкой SHA-1. */
export async function installMod(
  projectId: string,
  gameVersion: string,
  modsDir: string,
  signal?: AbortSignal,
): Promise<string> {
  const loaders = encodeURIComponent(JSON.stringify(['fabric']));
  const versions = encodeURIComponent(JSON.stringify([gameVersion]));
  const list = await fetchJson<ModVersion[]>(
    `${API}/project/${encodeURIComponent(projectId)}/version?loaders=${loaders}&game_versions=${versions}`,
    MODRINTH_NET,
    signal,
  );
  const file = list[0]?.files.find((f) => f.primary) ?? list[0]?.files[0];
  if (!file) throw new Error('Нет совместимой версии мода для этой версии игры');
  const name = file.filename.replace(/[\\/]/g, '_');
  await fs.mkdir(modsDir, { recursive: true });
  await downloadVerified({ url: file.url, path: join(modsDir, name), sha1: file.hashes.sha1, size: file.size }, MODRINTH_NET, signal);
  return name;
}

export async function listInstalledMods(modsDir: string): Promise<string[]> {
  try {
    return (await fs.readdir(modsDir)).filter((n) => n.endsWith('.jar')).sort();
  } catch {
    return [];
  }
}
