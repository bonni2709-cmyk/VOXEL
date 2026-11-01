import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertAllowedUrl, downloadVerified, resolveInside, runPool, safeRelativePath, sha1File } from '../net';

const BODY = Buffer.from('voxel-test-payload');
const SHA1 = createHash('sha1').update(BODY).digest('hex');
const opts = { hosts: ['127.0.0.1'], allowHttp: true };

let server: Server;
let base = '';
let dir = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/ok') res.end(BODY);
    else if (req.url === '/bad') res.end(Buffer.from('tampered!!!!!!!!!!!!!'));
    else { res.statusCode = 404; res.end(); }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  dir = await mkdtemp(join(tmpdir(), 'voxel-net-'));
});

afterAll(async () => {
  server.close();
  await rm(dir, { recursive: true, force: true });
});

describe('безопасность путей', () => {
  it('отклоняет выход за пределы корня (zip-slip / path traversal)', () => {
    expect(() => safeRelativePath('../etc/passwd')).toThrow();
    expect(() => safeRelativePath('/abs/file')).toThrow();
    expect(() => safeRelativePath('a\\b')).toThrow();
    expect(() => resolveInside('/root/x', 'a/../../b')).toThrow();
    expect(resolveInside('/root/x', 'a/b.jar')).toMatch(/[\\/]root[\\/]x[\\/]a[\\/]b\.jar$/);
  });
});

describe('allowlist хостов', () => {
  it('запрещает чужой хост и http без флага', () => {
    expect(() => assertAllowedUrl('https://evil.example.com/x', { hosts: ['piston-meta.mojang.com'] })).toThrow(/не в списке/);
    expect(() => assertAllowedUrl('http://piston-meta.mojang.com/x', { hosts: ['piston-meta.mojang.com'] })).toThrow(/протокол/);
  });
});

describe('downloadVerified', () => {
  it('скачивает и проверяет SHA-1', async () => {
    const path = join(dir, 'ok.bin');
    expect(await downloadVerified({ url: `${base}/ok`, path, sha1: SHA1, size: BODY.length }, opts)).toBe('downloaded');
    expect(await sha1File(path)).toBe(SHA1);
  });

  it('второй вызов пропускает уже корректный файл', async () => {
    const path = join(dir, 'ok.bin');
    expect(await downloadVerified({ url: `${base}/ok`, path, sha1: SHA1, size: BODY.length }, opts)).toBe('cached');
  });

  it('при несовпадении SHA-1 файл не появляется и временный удаляется', async () => {
    const path = join(dir, 'bad.bin');
    await expect(downloadVerified({ url: `${base}/bad`, path, sha1: SHA1 }, opts)).rejects.toThrow(/SHA-1|Размер/);
    await expect(readFile(path)).rejects.toThrow();
    const leftovers = (await readdir(dir)).filter((n) => n.startsWith('bad.bin.part-'));
    expect(leftovers).toEqual([]);
  });

  it('HTTP 404 даёт ошибку', async () => {
    await expect(downloadVerified({ url: `${base}/missing`, path: join(dir, 'm.bin') }, opts)).rejects.toThrow(/404/);
  });
});

describe('runPool', () => {
  it('ограничивает параллельность', async () => {
    let active = 0;
    let peak = 0;
    await runPool([1, 2, 3, 4, 5, 6, 7, 8], 3, async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it('ошибка одной задачи останавливает пул', async () => {
    const seen: number[] = [];
    await expect(
      runPool([1, 2, 3, 4, 5, 6], 2, async (n) => {
        seen.push(n);
        if (n === 2) throw new Error('boom');
        await new Promise((r) => setTimeout(r, 10));
      }),
    ).rejects.toThrow('boom');
    expect(seen.length).toBeLessThan(6);
  });
});

describe('SHA-256 при загрузке', () => {
  it('отклоняет файл с неверным SHA-256', async () => {
    await expect(
      downloadVerified({ url: `${base}/ok`, path: join(dir, 'sha256-bad.bin'), sha256: '0'.repeat(64) }, opts),
    ).rejects.toThrow(/SHA-256/);
  });
});
