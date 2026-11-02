import { useEffect, useState } from 'react';
import type { SystemMetrics } from '@shared/types';
import { Glass } from './Glass';

/** Живая загрузка CPU и RAM, опрос раз в секунду. */
export function SystemMonitor() {
  const [m, setM] = useState<SystemMetrics | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => void window.voxel.metrics.system().then((v) => alive && setM(v));
    tick();
    const id = setInterval(tick, 1000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const ramPct = m ? Math.round((m.ram.usedMb / m.ram.totalMb) * 100) : 0;

  return (
    <Glass className="grid grid-cols-2 gap-6 p-6">
      <Meter label="Процессор" value={m?.cpuPercent ?? 0} suffix="%" />
      <Meter
        label="Оперативная память"
        value={ramPct}
        suffix="%"
        detail={m ? `${(m.ram.usedMb / 1024).toFixed(1)} / ${(m.ram.totalMb / 1024).toFixed(1)} ГБ` : '—'}
      />
    </Glass>
  );
}

function Meter({ label, value, suffix, detail }: { label: string; value: number; suffix: string; detail?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-[var(--vx-muted)]">{label}</span>
        <span className="font-mono">{value}{suffix}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-[var(--vx-accent)] transition-[width] duration-700 ease-out"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      {detail && <div className="mt-2 text-[11px] text-[var(--vx-muted)]">{detail}</div>}
    </div>
  );
}
