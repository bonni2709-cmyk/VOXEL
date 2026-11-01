import { mkdtemp, mkdir, rm, writeFile, readdir, utimes } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import yazl from 'yazl';
import { satisfies, parseMcVersion, compareMc } from '../mcversion';
import { resolveDependencies, readModsDir, type FabricModMeta } from '../modmeta';
import { exportZip, exportMrpack, readMrpackIndex, scriptState, setScriptEnabled } from '../modpack';
import { listZipEntries, readZipText } from '../zip';
import { renderServerProperties, mergeServerProperties, pruneBackups } from '../server';
import { checkSkinPng, skinFileName } from '../skin';
import { buildAuthorizeUrl, parseAuthRedirect, xstsError, dashUuid, minecraftLoginBody } from '../msauth';

let root = '';
beforeAll(async () => { root = await mkdtemp(join(tmpdir(), 'voxel-logic-')); });
afterAll(async () => { await rm(root, { recursive: true, force: true }); });

function makeZip(file: string, entries: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    for (const [name, data] of Object.entries(entries)) zip.addBuffer(Buffer.from(data), name);
    zip.end();
    zip.outputStream.pipe(createWriteStream(file)).on('finish', () => resolve()).on('error', reject);
  });
}

describe('версии Minecraft и диапазоны', () => {
  it('разбирает pre-release и сравнивает правильно', () => {
    expect(compareMc(parseMcVersion('1.16')!, parseMcVersion('1.16-rc.3')!)).toBe(1);
    expect(compareMc(parseMcVersion('1.19-alpha.22.11.a')!, parseMcVersion('1.19-beta.1')!)).toBeLessThan(0);
  });
  it('поддерживает ~, >=, >, ^ и составные диапазоны', () => {
    expect(satisfies('26.3', '~26.3-')).toBe(true);
    expect(satisfies('26.3.1', '~26.3-')).toBe(true);
    expect(satisfies('26.4', '~26.3-')).toBe(false);
    expect(satisfies('1.16', '>=1.16-rc.3')).toBe(true);
    expect(satisfies('1.16-rc.2', '>=1.16-rc.3')).toBe(false);
    expect(satisfies('1.20', '>1.19-alpha.22.11.a')).toBe(true);
    expect(satisfies('1.21', '^1.20')).toBe(true);
    expect(satisfies('1.20', '>=1.19 <1.21')).toBe(true);
    expect(satisfies('1.21', '>=1.19 <1.21')).toBe(false);
  });
  it('нераспознанный формат даёт null, а не ошибку', () => {
    expect(satisfies('1.20', 'что-то странное')).toBeNull();
    expect(satisfies('weird', '>=1.0')).toBeNull();
  });
});

describe('резолвер зависимостей модов', () => {
  const mods: FabricModMeta[] = [
    { file: 'a.jar', id: 'lib', version: '2.1.0', depends: {}, conflicts: {} },
    {
      file: 'b.jar', id: 'mod', version: '1.0', depends: { minecraft: '>=1.20', lib: '>=2.0.0', fabricloader: '>=0.15' }, conflicts: {},
    },
    { file: 'c.jar', id: 'other', version: '1.0', depends: { needed: '*' }, conflicts: { lib: '>=2.0.0' } },
  ];
  it('находит отсутствующие, конфликты и несовместимую версию игры', () => {
    const f = resolveDependencies(mods, '1.19');
    const kinds = f.map((x) => `${x.mod}:${x.kind}`);
    expect(kinds).toContain('mod:minecraft');
    expect(kinds).toContain('other:missing');
    expect(kinds).toContain('other:conflict');
  });
  it('без проблем — пустой список', () => {
    const ok = mods.slice(0, 1).concat({ ...mods[1], depends: { minecraft: '~1.20-', lib: '>=2.0.0' } });
    expect(resolveDependencies(ok, '1.20.4')).toEqual([]);
  });
  it('читает fabric.mod.json из jar', async () => {
    const dir = join(root, 'mods');
    await mkdir(dir, { recursive: true });
    await makeZip(join(dir, 'x.jar'), { 'fabric.mod.json': JSON.stringify({ id: 'xmod', version: '3.0', depends: { minecraft: '*' } }) });
    await makeZip(join(dir, 'plain.jar'), { 'META-INF/MANIFEST.MF': 'x' });
    const metas = await readModsDir(dir);
    expect(metas.map((m) => m.id)).toEqual(['xmod']);
  });
});

describe('модпаки', () => {
  let inst = '';
  beforeAll(async () => {
    inst = join(root, 'inst');
    await mkdir(join(inst, 'mods'), { recursive: true });
    await mkdir(join(inst, 'kubejs'), { recursive: true });
    await mkdir(join(inst, 'logs'), { recursive: true });
    await writeFile(join(inst, 'options.txt'), 'fov:0');
    await writeFile(join(inst, 'mods', 'm.jar'), 'jar');
    await writeFile(join(inst, 'kubejs', 'server.js'), '//');
    await writeFile(join(inst, 'logs', 'latest.log'), 'x');
  });

  it('ZIP без логов, с исключением скриптов', async () => {
    const out = join(root, 'out', 'pack.zip');
    await exportZip(inst, out, { includeScripts: false });
    const names = await listZipEntries(out);
    expect(names.sort()).toEqual(['mods/m.jar', 'options.txt']);
  });

  it('ZIP со скриптами', async () => {
    const out = join(root, 'out', 'pack2.zip');
    await exportZip(inst, out, { includeScripts: true });
    expect(await listZipEntries(out)).toContain('kubejs/server.js');
  });

  it('mrpack: index + overrides, валидный индекс читается', async () => {
    const out = join(root, 'out', 'pack.mrpack');
    await exportMrpack(inst, out, { name: 'Тест', versionId: '1.0', gameVersion: '1.21.1', loaderVersion: '0.16.5' }, { includeScripts: false });
    const idx = await readMrpackIndex(out);
    expect(idx.name).toBe('Тест');
    expect(idx.dependencies.minecraft).toBe('1.21.1');
    expect(await listZipEntries(out)).toContain('overrides/mods/m.jar');
  });

  it('mrpack с чужим хостом отклоняется', async () => {
    const bad = join(root, 'bad.mrpack');
    await makeZip(bad, {
      'modrinth.index.json': JSON.stringify({
        name: 'x', versionId: '1', dependencies: { minecraft: '1.21' },
        files: [{ path: 'mods/a.jar', downloads: ['https://evil.example/a.jar'], hashes: {} }],
      }),
    });
    await expect(readMrpackIndex(bad)).rejects.toThrow(/Недоверенный хост/);
  });

  it('включение и выключение скриптов', async () => {
    await setScriptEnabled(inst, 'kubejs', false);
    expect((await scriptState(inst)).find((s) => s.dir === 'kubejs')).toMatchObject({ enabled: false, present: true });
    await setScriptEnabled(inst, 'kubejs', true);
    expect((await scriptState(inst)).find((s) => s.dir === 'kubejs')).toMatchObject({ enabled: true });
    await expect(setScriptEnabled(inst, '../etc', false)).rejects.toThrow();
  });
  it('чтение текста из zip', async () => {
    expect(await readZipText(join(root, 'bad.mrpack'), 'missing.txt')).toBeNull();
  });
});

describe('серверы', () => {
  it('server.properties: rcon и query выключены, seed не перезаписывается', () => {
    const props = renderServerProperties({ port: 25565, motd: 'A\nB', onlineMode: false, seed: '123' });
    expect(props).toContain('enable-rcon=false');
    expect(props).toContain('enable-query=false');
    expect(props).toContain('online-mode=false');
    expect(props).toContain('motd=A B');
    const merged = mergeServerProperties('level-seed=999\n', renderServerProperties({ port: 25565, motd: 'x', onlineMode: true, seed: '1' }));
    expect(merged).toContain('level-seed=999');
    expect(merged).not.toContain('level-seed=1\n');
  });

  it('pruneBackups оставляет 5 самых свежих', async () => {
    const dir = join(root, 'backups');
    await mkdir(dir, { recursive: true });
    for (let i = 0; i < 7; i++) {
      const f = join(dir, `w-${i}.zip`);
      await writeFile(f, 'z');
      const t = new Date(Date.now() - (7 - i) * 60_000);
      await utimes(f, t, t);
    }
    const removed = await pruneBackups(dir, 5);
    expect(removed.sort()).toEqual(['w-0.zip', 'w-1.zip']);
    expect((await readdir(dir)).length).toBe(5);
  });
});

describe('скины', () => {
  function png(w: number, h: number, colorType = 6, depth = 8): Buffer {
    const b = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
    b.writeUInt32BE(13, 8);
    b.write('IHDR', 12, 'latin1');
    b.writeUInt32BE(w, 16);
    b.writeUInt32BE(h, 20);
    b[24] = depth;
    b[25] = colorType;
    return b;
  }
  it('принимает 64x64 RGBA и 64x32', () => {
    expect(checkSkinPng(png(64, 64))).toMatchObject({ ok: true, width: 64, height: 64 });
    expect(checkSkinPng(png(64, 32)).ok).toBe(true);
  });
  it('отклоняет чужие размеры, не-PNG и RGB без альфы', () => {
    expect(checkSkinPng(png(128, 128)).ok).toBe(false);
    expect(checkSkinPng(Buffer.from('hello world, not a png at all, definitely more than 33 bytes'))).toMatchObject({ ok: false, error: 'Это не PNG' });
    expect(checkSkinPng(png(64, 64, 2)).ok).toBe(true);
    expect(checkSkinPng(png(64, 64, 0)).ok).toBe(false);
    expect(checkSkinPng(Buffer.alloc(129 * 1024)).ok).toBe(false);
  });
  it('имя файла скина ограничено', () => {
    expect(skinFileName('my_skin-1')).toBe('my_skin-1.png');
    expect(skinFileName('../evil')).toBeNull();
  });
});

describe('Microsoft-авторизация (чистые части)', () => {
  it('собирает URL входа и разбирает редирект', () => {
    const url = buildAuthorizeUrl('client-123');
    expect(url).toContain('client_id=client-123');
    expect(url).toContain('response_type=code');
    expect(parseAuthRedirect('https://login.live.com/oauth20_desktop.srf?code=ABC')).toEqual({ code: 'ABC' });
    expect(parseAuthRedirect('https://login.live.com/oauth20_desktop.srf?error=access_denied&error_description=cancel')).toEqual({ error: 'Microsoft отклонил вход: cancel' });
    expect(parseAuthRedirect('https://evil.example/?code=1')).toHaveProperty('error');
  });
  it('коды ошибок XSTS и заголовок Minecraft login', () => {
    expect(xstsError(2148916233)).toMatch(/Xbox-профиля/);
    expect(xstsError(undefined)).toBe('Ошибка авторизации Xbox');
    expect(minecraftLoginBody('123', 'TOKEN')).toEqual({ identityToken: 'XBL3.0 x=123;TOKEN' });
    expect(dashUuid('0123456789abcdef0123456789abcdef')).toBe('01234567-89ab-cdef-0123-456789abcdef');
    expect(() => dashUuid('zz')).toThrow();
  });
});

import { javaMajorFor } from '../mcversion';
describe('Java для версии Minecraft', () => {
  it('подбирает major-версию', () => {
    expect(javaMajorFor('1.16.5')).toBe(8);
    expect(javaMajorFor('1.18.2')).toBe(17);
    expect(javaMajorFor('1.20.4')).toBe(17);
    expect(javaMajorFor('1.20.5')).toBe(21);
    expect(javaMajorFor('1.21.1')).toBe(21);
    expect(javaMajorFor('26.3')).toBe(25);
  });
});

import { parseMyMemory } from '../translate';
describe('перевод описаний', () => {
  it('разбирает успешный ответ MyMemory и отбрасывает ошибки', () => {
    expect(parseMyMemory({ responseStatus: 200, responseData: { translatedText: 'Привет' } })).toBe('Привет');
    expect(parseMyMemory({ responseStatus: '200', responseData: { translatedText: 'Ок' } })).toBe('Ок');
    expect(parseMyMemory({ responseStatus: 403, responseData: { translatedText: 'x' } })).toBeNull();
    expect(parseMyMemory({ responseStatus: 200, responseData: { translatedText: '  ' } })).toBeNull();
    expect(parseMyMemory(null)).toBeNull();
  });
});
