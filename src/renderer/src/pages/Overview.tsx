import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Play, ShieldCheck, Square } from 'lucide-react';
import { Glass } from '../components/Glass';
import { useSettings } from '../store/settings';
import { useLauncher } from '../store/launcher';
import heroUrl from '../assets/hero.jpg';

export function Overview() {
  const ramMb = useSettings((s) => s.ramMb);
  const setRam = useSettings((s) => s.setRam);
  const javaPath = useSettings((s) => s.javaPath);
  const selected = useSettings((s) => s.selectedVersion);
  const setPage = useSettings((s) => s.setPage);
  const installed = useLauncher((s) => s.installed);
  const installing = useLauncher((s) => s.installing);
  const running = useLauncher((s) => s.running);
  const play = useLauncher((s) => s.play);
  const stop = useLauncher((s) => s.stop);
  const install = useLauncher((s) => s.install);
  const [maxMb, setMaxMb] = useState(11776);

  const isInstalled = selected !== null && installed.includes(selected);

  useEffect(() => {
    void window.voxel.systemInfo().then((info) => setMaxMb(info.totalMemoryMb));
  }, []);

  let action;
  if (!selected) {
    action = (
      <button onClick={() => setPage('versions')} className="h-14 rounded-2xl bg-white/[0.08] px-8 text-[15px] backdrop-blur">
        Выбрать версию
      </button>
    );
  } else if (running) {
    action = (
      <button onClick={() => void stop()} className="flex h-14 items-center gap-2 rounded-2xl bg-red-500/20 px-8 text-[15px] text-red-200">
        <Square size={16} fill="currentColor" /> Остановить
      </button>
    );
  } else if (!isInstalled) {
    action = (
      <button
        disabled={installing !== null}
        onClick={() => void install(selected)}
        className="flex h-14 items-center gap-2 rounded-2xl bg-[var(--vx-accent)] px-8 text-[15px] font-medium text-black/85 shadow-[0_0_30px_-8px_var(--vx-accent)] disabled:opacity-50"
      >
        <Download size={18} /> {installing ? 'Установка…' : 'Установить'}
      </button>
    );
  } else {
    action = (
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => void play(selected, ramMb, javaPath)}
        className="flex h-16 items-center gap-3 rounded-2xl bg-[var(--vx-accent)] px-12 text-lg font-semibold text-black/85 shadow-[0_0_40px_-6px_var(--vx-accent)]"
      >
        <Play size={22} fill="currentColor" /> Играть
      </motion.button>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative h-72 overflow-hidden rounded-3xl border border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      >
        <img src={heroUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F1115] via-[#0F1115]/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-[var(--vx-muted)]">Обзор</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white drop-shadow-lg">Новый мир. Твоя история</h1>
            <div className="mt-3 flex items-center gap-2 text-sm text-white/70">
              <ShieldCheck size={16} className="text-[var(--vx-accent)]" />
              {selected ? `Minecraft ${selected}` : 'Версия не выбрана'} · {isInstalled ? 'установлена' : 'не установлена'}
            </div>
          </div>
          {action}
        </div>
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
      >
        <Glass className="p-6">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-[var(--vx-muted)]">Выделенная ОЗУ</span>
            <span className="font-mono text-lg">
              {ramMb} <span className="text-xs text-[var(--vx-muted)]">МБ</span>
            </span>
          </div>
          <input
            type="range"
            min={512}
            max={maxMb}
            step={256}
            value={Math.min(ramMb, maxMb)}
            onChange={(e) => setRam(Number(e.target.value))}
            className="mt-4 w-full accent-[var(--vx-accent)]"
          />
          <div className="mt-2 flex justify-between text-[10px] text-[var(--vx-muted)]">
            <span>512 МБ</span>
            <span>На устройстве {(maxMb / 1024).toFixed(1)} ГБ</span>
          </div>
        </Glass>
      </motion.div>
    </div>
  );
}
