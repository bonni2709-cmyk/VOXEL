import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { extractNatives } from './natives';
import { fetchJson, downloadVerified, type NetOptions } from './net';
import type { DataPaths } from './paths';

export const JAVA_MAJORS = [8, 17, 21, 25] as const;

const ADOPTIUM_HOSTS = ['api.adoptium.net', 'github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com'];
const NET: NetOptions = { hosts: ADOPTIUM_HOSTS };

interface AdoptiumAsset {
  binary: { package: { link: string; checksum: string; size: number; name: string } };
  release_name: string;
}

function adoptiumPlatform(): { os: string; arch: string } {
  const os = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux';
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
  return { os, arch };
}

export function javaRuntimeDir(paths: DataPaths, major: number): string {
  return join(paths.root, 'runtime', `java-${major}`);
}

/** Ищет bin/java(.exe) внутри распакованного JDK (глубина до 3). */
export async function findJavaExecutable(dir: string, depth = 0): Promise<string | null> {
  const exe = process.platform === 'win32' ? 'java.exe' : 'java';
  const direct = join(dir, 'bin', exe);
  try {
    await fs.access(direct);
    return direct;
  } catch {
    // продолжаем поиск во вложенных каталогах
  }
  if (depth >= 3) return null;
  let entries: import('node:fs').Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const found = await findJavaExecutable(join(dir, e.name), depth + 1);
    if (found) return found;
  }
  return null;
}

export async function javaStatus(paths: DataPaths): Promise<number[]> {
  const installed: number[] = [];
  for (const major of JAVA_MAJORS) {
    if (await findJavaExecutable(javaRuntimeDir(paths, major), 0)) installed.push(major);
  }
  return installed;
}

/**
 * Скачивает Temurin JDK (Adoptium API, HotSpot) с проверкой SHA-256 из API,
 * распаковывает и возвращает путь к java.
 */
export async function installJava(major: number, paths: DataPaths, signal?: AbortSignal): Promise<string> {
  if (!(JAVA_MAJORS as readonly number[]).includes(major)) throw new Error(`Неподдерживаемая Java ${major}`);
  const { os, arch } = adoptiumPlatform();
  const url = `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?architecture=${arch}&image_type=jdk&os=${os}&vendor=eclipse`;
  const assets = await fetchJson<AdoptiumAsset[]>(url, NET, signal);
  const asset = assets[0];
  if (!asset) throw new Error(`Adoptium не вернул Java ${major} для ${os}/${arch}`);

  const pkg = asset.binary.package;
  const archive = join(paths.root, 'runtime', 'downloads', pkg.name);
  await downloadVerified({ url: pkg.link, path: archive, sha256: pkg.checksum, size: pkg.size }, NET, signal);

  const dest = javaRuntimeDir(paths, major);
  await fs.rm(dest, { recursive: true, force: true });
  await fs.mkdir(dest, { recursive: true });
  await extractNatives(archive, dest, []);
  const exe = await findJavaExecutable(dest);
  if (!exe) throw new Error('В архиве JDK не найден java');
  return exe;
}
