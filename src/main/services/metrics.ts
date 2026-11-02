import { cpus, freemem, totalmem } from 'node:os';

export interface CpuSample { idle: number; total: number }

export function cpuSample(): CpuSample {
  let idle = 0;
  let total = 0;
  for (const c of cpus()) {
    const t = c.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.idle + t.irq;
  }
  return { idle, total };
}

/** Загрузка CPU в процентах между двумя снимками. */
export function cpuPercent(prev: CpuSample, cur: CpuSample): number {
  const dt = cur.total - prev.total;
  if (dt <= 0) return 0;
  const busy = dt - (cur.idle - prev.idle);
  return Math.max(0, Math.min(100, Math.round((busy / dt) * 100)));
}

export interface RamSample { usedMb: number; totalMb: number }

export function ramSample(): RamSample {
  const total = totalmem();
  return { totalMb: Math.floor(total / 1048576), usedMb: Math.floor((total - freemem()) / 1048576) };
}
