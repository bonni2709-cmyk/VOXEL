import { ipcMain } from 'electron';
import { join } from 'node:path';
import { IPC } from '../../shared/ipc';
import type { IpcResult, JvmPreset, SystemMetrics, WorldMap } from '../../shared/types';
import { dataPaths, dataRoot } from '../services/paths';
import { instanceDir, jvmFlagsFor } from '../services/launch';
import { clampRam, turboRamMb } from '../services/perf';
import { cpuPercent, cpuSample, ramSample, type CpuSample } from '../services/metrics';
import { mapOverview } from '../services/mca';
import { setShieldConfig } from '../services/netshield';
import { buildModpack, type LlmProvider } from '../services/aimodpack';
import { getSecret, hasSecret, setSecret, SECRET_NAMES, type SecretName } from '../services/secrets';
import { openBoreTunnel, type BoreTunnel } from '../services/bore';
import { totalmem } from 'node:os';

const guard = <T>(fn: () => Promise<T>): Promise<IpcResult<T>> =>
  fn().then((data) => ({ ok: true as const, data }), (err: Error) => ({ ok: false as const, error: err.message }));

const ID_RE = /^[\w.-]{1,64}$/;

let prevCpu: CpuSample = cpuSample();
let tunnel: BoreTunnel | null = null;

export function currentTunnel(): BoreTunnel | null {
  return tunnel;
}

export function closeTunnel(): void {
  tunnel?.close();
  tunnel = null;
}

export function registerV5Ipc(): void {
  ipcMain.handle(IPC.sysMetrics, (): SystemMetrics => {
    const cur = cpuSample();
    const cpu = cpuPercent(prevCpu, cur);
    prevCpu = cur;
    return { cpuPercent: cpu, ram: ramSample() };
  });

  ipcMain.handle(IPC.perfTurbo, (): number => turboRamMb(Math.floor(totalmem() / 1048576)));

  ipcMain.handle(IPC.perfPreview, (_e, ramMb: unknown, preset: unknown, custom: unknown): string[] => {
    const ram = clampRam(typeof ramMb === 'number' ? ramMb : 2048);
    const p: JvmPreset = preset === 'none' || preset === 'custom' ? preset : 'aikar';
    return jvmFlagsFor({ ramMb: ram, jvmPreset: p, customFlags: typeof custom === 'string' ? custom.slice(0, 2000) : '' });
  });

  ipcMain.handle(IPC.secretsSet, (_e, name: unknown, value: unknown) =>
    guard(async () => {
      if (!SECRET_NAMES.includes(name as SecretName)) throw new Error('Неизвестный секрет');
      if (typeof value !== 'string' || value.length > 512) throw new Error('Некорректное значение');
      await setSecret(dataRoot(), name as SecretName, value.trim());
      return null;
    }),
  );

  ipcMain.handle(IPC.secretsHas, (_e, name: unknown): Promise<boolean> =>
    SECRET_NAMES.includes(name as SecretName) ? hasSecret(dataRoot(), name as SecretName) : Promise.resolve(false),
  );

  ipcMain.handle(IPC.shieldSet, (_e, cfg: unknown) =>
    guard(async () => {
      const c = (cfg ?? {}) as { proxy?: unknown; mirror?: unknown };
      setShieldConfig({
        proxy: typeof c.proxy === 'string' ? c.proxy : undefined,
        mirror: typeof c.mirror === 'string' ? c.mirror : undefined,
      });
      return null;
    }),
  );

  ipcMain.handle(IPC.aiModpack, (_e, provider: unknown, text: unknown, gameVersion: unknown) =>
    guard(async () => {
      if (provider !== 'groq' && provider !== 'mistral') throw new Error('Провайдер: groq или mistral');
      if (typeof text !== 'string' || text.trim().length < 5) throw new Error('Опишите сборку подробнее');
      if (typeof gameVersion !== 'string' || !ID_RE.test(gameVersion)) throw new Error('Выберите версию игры');
      const key = await getSecret(dataRoot(), (provider === 'groq' ? 'groqKey' : 'mistralKey') as SecretName);
      if (!key) throw new Error('Добавьте ключ API провайдера в Настройках');
      const picks = await buildModpack(provider as LlmProvider, key, text.trim(), gameVersion);
      return picks.map((p) => ({ hit: p.hit, reason: p.reason }));
    }),
  );

  ipcMain.handle(IPC.worldMap, (_e, id: unknown, world: unknown) =>
    guard<WorldMap>(async () => {
      if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error('Некорректная версия');
      if (typeof world !== 'string' || !ID_RE.test(world)) throw new Error('Некорректный мир');
      const regions = await mapOverview(join(instanceDir(dataPaths(dataRoot()), id), 'saves', world));
      return {
        regions,
        totalChunks: regions.reduce((a, r) => a + r.chunks, 0),
      };
    }),
  );

  ipcMain.handle(IPC.serverPublish, (_e, enable: unknown, port: unknown) =>
    guard(async () => {
      if (enable === false) {
        closeTunnel();
        return { address: null };
      }
      if (typeof port !== 'number' || port < 1024 || port > 65535) throw new Error('Порт: 1024–65535');
      closeTunnel();
      tunnel = await openBoreTunnel(port);
      return { address: tunnel.publicAddress };
    }),
  );
}
