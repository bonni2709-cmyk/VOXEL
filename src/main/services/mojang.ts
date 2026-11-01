import { fetchJson, MOJANG_HOSTS, type NetOptions } from './net';
import type { RawLibrary } from './libraries';
import type { VersionArguments } from './args';
import type { VersionSummary } from '../../shared/types';

export const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

export const NET: NetOptions = { hosts: MOJANG_HOSTS };

export interface ManifestEntry {
  id: string;
  type: VersionSummary['type'];
  url: string;
  time: string;
  releaseTime: string;
  sha1?: string;
}

export interface VersionJson {
  id: string;
  type: string;
  mainClass: string;
  assets?: string;
  assetIndex?: { id: string; url: string; sha1?: string; size?: number };
  downloads?: {
    client?: { url: string; sha1?: string; size?: number };
    server?: { url: string; sha1?: string; size?: number };
  };
  libraries: RawLibrary[];
  arguments?: VersionArguments;
  minecraftArguments?: string;
  javaVersion?: { component: string; majorVersion: number };
}

export interface AssetIndex {
  objects: Record<string, { hash: string; size: number }>;
}

export async function fetchManifest(signal?: AbortSignal): Promise<ManifestEntry[]> {
  const data = await fetchJson<{ versions: ManifestEntry[] }>(MANIFEST_URL, NET, signal);
  return data.versions;
}

export function toSummary(entry: ManifestEntry): VersionSummary {
  return { id: entry.id, type: entry.type, releaseTime: entry.releaseTime };
}

export function assetObjectUrl(hash: string): string {
  return `https://resources.download.minecraft.net/${hash.slice(0, 2)}/${hash}`;
}
