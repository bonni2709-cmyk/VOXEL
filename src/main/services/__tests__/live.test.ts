import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fetchManifest, NET, type VersionJson } from '../mojang';
import { downloadVerified } from '../net';
import { resolveLibraries } from '../libraries';

// Живой тест против серверов Mojang: запускается только с MOJANG_LIVE=1 (в CI).
const live = process.env['MOJANG_LIVE'] === '1' ? describe : describe.skip;

live('Mojang live', () => {
  it('манифест, version JSON с проверкой SHA-1 и client.jar', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'voxel-live-'));
    try {
      const manifest = await fetchManifest();
      const entry = manifest.find((e) => e.id === '1.21.1');
      expect(entry).toBeDefined();
      expect(entry?.sha1).toMatch(/^[0-9a-f]{40}$/);

      const vjPath = join(dir, '1.21.1.json');
      await downloadVerified({ url: entry!.url, path: vjPath, sha1: entry!.sha1 }, NET);
      const vj = JSON.parse(await readFile(vjPath, 'utf8')) as VersionJson;
      expect(vj.mainClass).toBeTruthy();
      expect(vj.downloads?.client?.url).toMatch(/^https:\/\//);

      const jarPath = join(dir, '1.21.1.jar');
      const client = vj.downloads!.client!;
      await downloadVerified({ url: client.url, path: jarPath, sha1: client.sha1, size: client.size }, NET);

      const libs = resolveLibraries(vj.libraries, { osName: 'windows', arch: 'x64', features: {} });
      expect(libs.artifacts.length).toBeGreaterThan(10);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 180_000);
});
