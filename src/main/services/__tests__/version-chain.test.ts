import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dataPaths } from '../layout';
import { loadVersion, mergeVersion } from '../version-chain';
import type { VersionJson } from '../mojang';

let root = '';
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'voxel-chain-'));
  const p = dataPaths(root);
  await mkdir(join(p.versions, '26.3'), { recursive: true });
  await mkdir(join(p.versions, 'fabric-loader-0.20.1-26.3'), { recursive: true });
  await writeFile(join(p.versions, '26.3', '26.3.json'), JSON.stringify({
    id: '26.3', type: 'release', mainClass: 'net.minecraft.client.main.Main',
    assetIndex: { id: '26', url: 'https://piston-meta.mojang.com/x.json' },
    libraries: [{ name: 'a:a:1', downloads: { artifact: { path: 'a/a/1/a-1.jar', url: 'https://libraries.minecraft.net/a-1.jar' } } }],
    arguments: { game: ['--version', '${version_name}'], jvm: ['-Dvanilla=1'] },
  }));
  await writeFile(join(p.versions, '26.3', '26.3.jar'), 'jar');
  await writeFile(join(p.versions, 'fabric-loader-0.20.1-26.3', 'fabric-loader-0.20.1-26.3.json'), JSON.stringify({
    id: 'fabric-loader-0.20.1-26.3', inheritsFrom: '26.3', type: 'release',
    mainClass: 'net.fabricmc.loader.impl.launch.knot.KnotClient',
    libraries: [{ name: 'f:f:2', url: 'https://maven.fabricmc.net/' }],
    arguments: { jvm: ['-Dfabric=1'] },
  }));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('цепочка inheritsFrom', () => {
  it('Fabric наследует vanilla: mainClass свой, библиотеки и аргументы объединяются', async () => {
    const { vj, jarId } = await loadVersion(dataPaths(root), 'fabric-loader-0.20.1-26.3');
    expect(jarId).toBe('26.3');
    expect(vj.mainClass).toBe('net.fabricmc.loader.impl.launch.knot.KnotClient');
    expect(vj.libraries.map((l) => l.name)).toEqual(['f:f:2', 'a:a:1']);
    expect(vj.arguments?.jvm).toEqual(['-Dvanilla=1', '-Dfabric=1']);
    expect(vj.assetIndex?.id).toBe('26');
  });

  it('mergeVersion: child.minecraftArguments имеет приоритет', () => {
    const parent: VersionJson = { id: 'p', type: 'release', mainClass: 'M', libraries: [], minecraftArguments: 'old' };
    const child = { id: 'c', type: 'release', mainClass: 'C', libraries: [], minecraftArguments: 'new' } as VersionJson;
    expect(mergeVersion(parent, child).minecraftArguments).toBe('new');
  });
});
