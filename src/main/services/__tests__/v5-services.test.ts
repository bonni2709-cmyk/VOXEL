import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import { connect as netConnect } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aikarFlags, clampRam, parseCustomFlags, turboRamMb } from '../perf';
import { cpuPercent } from '../metrics';
import { mapOverview, parseRegionHeader, regionCoords } from '../mca';
import { isNoFallbackHost, planRoutes, mirrorUrl, shieldFetch, HEADER_TIMEOUT_MS } from '../netshield';
import { encodeFrame, FrameDecoder } from '../bore';
import { parseSuggestions, buildMessages } from '../aimodpack';
import { parseMyMemory } from '../translate';

let root = '';
beforeAll(async () => { root = await mkdtemp(join(tmpdir(), 'voxel-v5-')); });
afterAll(async () => { await rm(root, { recursive: true, force: true }); });

describe('Java Performance Tuner', () => {
  it('Aikar: Xms=Xmx и G1GC; для больших куч другие проценты', () => {
    const small = aikarFlags(4096);
    expect(small).toContain('-Xmx4096M');
    expect(small).toContain('-Xms4096M');
    expect(small).toContain('-XX:+UseG1GC');
    expect(small).toContain('-XX:G1NewSizePercent=30');
    expect(aikarFlags(16384)).toContain('-XX:G1NewSizePercent=40');
  });
  it('Турбо: 4–5 ГБ, но оставляет системе 2 ГБ', () => {
    expect(turboRamMb(16 * 1024)).toBe(5120);
    expect(turboRamMb(8 * 1024)).toBe(4096);
    expect(turboRamMb(6 * 1024)).toBeLessThanOrEqual(4096);
    expect(turboRamMb(6 * 1024)).toBeGreaterThanOrEqual(2048);
  });
  it('ползунок: шаг 256 и границы 512…8192', () => {
    expect(clampRam(100)).toBe(512);
    expect(clampRam(1000)).toBe(1024);
    expect(clampRam(99999)).toBe(8192);
  });
  it('пользовательские флаги: только строки с «-»', () => {
    expect(parseCustomFlags('-XX:+UseZGC  foo -Dx=1')).toEqual(['-XX:+UseZGC', '-Dx=1']);
  });
});

describe('CPU и карта', () => {
  it('загрузка CPU по снимкам', () => {
    expect(cpuPercent({ idle: 100, total: 200 }, { idle: 150, total: 300 })).toBe(50);
    expect(cpuPercent({ idle: 100, total: 200 }, { idle: 100, total: 200 })).toBe(0);
  });
  it('заголовок региона: считает записи с ненулевым смещением и размером', () => {
    const h = Buffer.alloc(4096);
    h.writeUIntBE(2, 0, 3); h[3] = 1;   // чанк 0
    h.writeUIntBE(5, 4, 3); h[7] = 2;   // чанк 1
    h.writeUIntBE(9, 8, 3); h[11] = 0;  // size 0 — не считается
    expect(parseRegionHeader(h)).toBe(2);
  });
  it('координаты региона из имени', () => {
    expect(regionCoords('r.-1.2.mca')).toEqual({ x: -1, z: 2 });
    expect(regionCoords('notes.txt')).toBeNull();
  });
  it('мир без папки region — пустой список, а не ошибка (ENOENT)', async () => {
    expect(await mapOverview(join(root, 'no-world'))).toEqual([]);
  });
  it('сводка по реальному файлу региона', async () => {
    const world = join(root, 'world');
    await mkdir(join(world, 'region'), { recursive: true });
    const h = Buffer.alloc(8192);
    h.writeUIntBE(2, 0, 3); h[3] = 1;
    await writeFile(join(world, 'region', 'r.0.0.mca'), h);
    const map = await mapOverview(world);
    expect(map).toEqual([expect.objectContaining({ file: 'r.0.0.mca', chunks: 1, sizeBytes: 8192 })]);
  });
});

describe('Network Shield', () => {
  it('Microsoft / Xbox / VirusTotal — только прямой маршрут', () => {
    expect(isNoFallbackHost('login.live.com')).toBe(true);
    expect(isNoFallbackHost('user.auth.xboxlive.com')).toBe(true);
    expect(isNoFallbackHost('www.virustotal.com')).toBe(true);
    expect(isNoFallbackHost('notlive.com')).toBe(false);
    expect(planRoutes('https://login.live.com/x', { proxy: 'http://p:1', mirror: 'https://m.example' })).toEqual(['direct']);
  });
  it('порядок: direct → proxy → mirror', () => {
    expect(planRoutes('https://piston-meta.mojang.com/x', { proxy: 'http://p:1', mirror: 'https://m.example' }))
      .toEqual(['direct', 'proxy', 'mirror']);
  });
  it('зеркало подменяет origin и сохраняет путь', () => {
    expect(mirrorUrl('https://piston-meta.mojang.com/mc/v2.json?a=1', 'https://m.example/base/')).toBe('https://m.example/base/mc/v2.json?a=1');
  });
  it('прямой маршрут падает — срабатывает запасной', async () => {
    const ok = new Response('ok', { status: 200 });
    const res = await shieldFetch('https://piston-meta.mojang.com/x', { mirror: 'https://m.example' }, {
      direct: async () => { throw new Error('ECONNRESET'); },
      mirror: async (url) => (url.startsWith('https://m.example/') ? ok : new Response(null, { status: 500 })),
    }, 50);
    expect(res.route).toBe('mirror');
  });
  it('таймаут заголовков: медленный маршрут обрывается', async () => {
    const res = await shieldFetch('https://piston-meta.mojang.com/x', {}, {
      direct: (_u, signal) => new Promise<Response>((_, reject) => {
        signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }),
    }, 30).catch((e: Error) => e);
    expect(res).toBeInstanceOf(Error);
    expect((res as Error).message).toMatch(/таймаут 15 с/);
    expect(HEADER_TIMEOUT_MS).toBe(15_000);
  });
  it('прокси пользователя: запрос идёт через CONNECT-туннель ProxyAgent', async () => {
    const target: Server = createServer((_q, resp) => { resp.end('via-proxy'); });
    await new Promise<void>((r) => target.listen(0, '127.0.0.1', () => r()));
    const targetPort = (target.address() as { port: number }).port;
    const tunnels: string[] = [];
    const proxy: Server = createServer((_req, resp) => { resp.writeHead(405); resp.end(); });
    proxy.on('connect', (req, sock, head) => {
      tunnels.push(req.url ?? '');
      const [host, port] = (req.url ?? '').split(':');
      const up = netConnect(Number(port), host, () => {
        sock.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        up.write(head);
        up.pipe(sock);
        sock.pipe(up);
      });
      up.on('error', () => sock.destroy());
      sock.on('error', () => up.destroy());
    });
    await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', () => r()));
    const proxyPort = (proxy.address() as { port: number }).port;
    try {
      const { response, route } = await shieldFetch(`http://127.0.0.1:${targetPort}/file.txt`, { proxy: `http://127.0.0.1:${proxyPort}` }, {
        direct: async () => { throw new Error('тест: прямой маршрут недоступен'); },
      });
      expect(route).toBe('proxy');
      expect(await response.text()).toBe('via-proxy');
      expect(tunnels).toEqual([`127.0.0.1:${targetPort}`]);
    } finally {
      proxy.close();
      target.close();
    }
  });
});

describe('bore: протокол кадров', () => {
  it('кадр кодируется и декодируется кусками любого размера', () => {
    const msgs = [{ Hello: 0 }, { Connection: 'abc-123' }, { Accept: 'abc-123' }] as const;
    const wire = Buffer.concat(msgs.map((m) => encodeFrame(m as never)));
    const dec = new FrameDecoder();
    const out: unknown[] = [];
    for (let i = 0; i < wire.length; i += 3) out.push(...dec.push(wire.subarray(i, i + 3)));
    expect(out).toEqual(msgs);
  });
  it('слишком большой кадр отклоняется', () => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(10_000_000, 0);
    expect(() => new FrameDecoder().push(head)).toThrow(/Слишком большой/);
  });
});

describe('AI Modpack Builder', () => {
  it('разбирает JSON даже в обрамлении текста, отбрасывает мусор', () => {
    const content = 'Вот список:\n{"mods":[{"query":"JEI","reason":"рецепты"},{"query":"x"},{"query":5},{"query":"Mekanism","reason":"техника"}]}\nГотово.';
    expect(parseSuggestions(content)).toEqual([
      { query: 'JEI', reason: 'рецепты' },
      { query: 'x', reason: '' }.query.length >= 2 ? { query: 'x', reason: '' } : { query: 'x', reason: '' },
      { query: 'Mekanism', reason: 'техника' },
    ].filter((s) => s.query.length >= 2));
    expect(parseSuggestions('не json')).toEqual([]);
  });
  it('промпт содержит версию и требует JSON', () => {
    const msgs = buildMessages('магия и технологии', '1.21.1');
    expect(msgs[0].content).toContain('1.21.1');
    expect(msgs[0].content).toContain('JSON');
    expect(msgs[1].content).toBe('магия и технологии');
  });
});

describe('перевод', () => {
  it('ответ MyMemory', () => {
    expect(parseMyMemory({ responseStatus: 200, responseData: { translatedText: 'ок' } })).toBe('ок');
  });
});
