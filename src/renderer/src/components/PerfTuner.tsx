import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { Glass } from './Glass';
import { useSettings } from '../store/settings';
import type { JvmPreset } from '@shared/types';

const PRESETS: { id: JvmPreset; label: string; hint: string }[] = [
  { id: 'aikar', label: "Aikar's", hint: 'G1GC с настройками Aikar — рекомендуется' },
  { id: 'none', label: 'Только -Xmx', hint: 'Без доп. флагов' },
  { id: 'custom', label: 'Свои флаги', hint: 'Введите JVM-флаги сами' },
];

/** Java Performance Tuner: ОЗУ 512 МБ…8 ГБ, пресеты JVM и «Оптимизировать» (Турбо). */
export function PerfTuner({ maxMb }: { maxMb: number }) {
  const ramMb = useSettings((s) => s.ramMb);
  const setRam = useSettings((s) => s.setRam);
  const preset = useSettings((s) => s.jvmPreset);
  const setPreset = useSettings((s) => s.setJvmPreset);
  const custom = useSettings((s) => s.customFlags);
  const setCustom = useSettings((s) => s.setCustomFlags);
  const [flags, setFlags] = useState<string[]>([]);
  const [turboMsg, setTurboMsg] = useState<string | null>(null);
  const cap = Math.min(8192, maxMb);

  useEffect(() => {
    void window.voxel.perf.preview(ramMb, preset, custom).then(setFlags);
  }, [ramMb, preset, custom]);

  async function optimize() {
    const mb = await window.voxel.perf.turboRam();
    setRam(mb);
    setPreset('aikar');
    setTurboMsg(`Турбо: ${(mb / 1024).toFixed(1)} ГБ, флаги Aikar`);
    setTimeout(() => setTurboMsg(null), 3000);
  }

  return (
    <Glass className="flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Java Performance Tuner</div>
          <div className="mt-0.5 text-[11px] text-[var(--vx-muted)]">Память и флаги JVM для запуска</div>
        </div>
        <button
          onClick={() => void optimize()}
          className="flex items-center gap-2 rounded-xl bg-[var(--vx-accent)] px-4 py-2 text-sm font-medium text-black/85 shadow-[0_0_24px_-8px_var(--vx-accent)]"
        >
          <Zap size={15} /> Оптимизировать
        </button>
      </div>
      {turboMsg && <div className="text-[12px] text-[var(--vx-accent)]">{turboMsg}</div>}

      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--vx-muted)]">Выделенная ОЗУ</span>
          <span className="font-mono text-lg">{ramMb} <span className="text-xs text-[var(--vx-muted)]">МБ</span></span>
        </div>
        <input
          type="range"
          min={512}
          max={cap}
          step={256}
          value={Math.min(ramMb, cap)}
          onChange={(e) => setRam(Number(e.target.value))}
          className="mt-4 w-full accent-[var(--vx-accent)]"
        />
        <div className="mt-2 flex justify-between text-[10px] text-[var(--vx-muted)]">
          <span>512 МБ</span>
          <span>8 ГБ · на устройстве {(maxMb / 1024).toFixed(1)} ГБ</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-[var(--vx-muted)]">Флаги JVM</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              title={p.hint}
              onClick={() => setPreset(p.id)}
              className={`rounded-xl px-3 py-1.5 text-xs ${preset === p.id ? 'bg-[var(--vx-accent)] text-black/85' : 'bg-white/[0.06]'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <textarea
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            rows={3}
            placeholder="-XX:+UseZGC -Dfile.encoding=UTF-8"
            className="rounded-xl border border-white/5 bg-black/25 px-3 py-2 font-mono text-[12px] outline-none focus:border-[var(--vx-accent)]/60"
          />
        )}
        <details className="text-[11px] text-[var(--vx-muted)]">
          <summary className="cursor-pointer">Будет передано {flags.length} флагов</summary>
          <div className="mt-2 max-h-40 overflow-y-auto break-all rounded-lg bg-black/30 p-2 font-mono">{flags.join(' ')}</div>
        </details>
      </div>
    </Glass>
  );
}
