import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Play, ShieldCheck, Square } from 'lucide-react';
import { Glass } from '../components/Glass';
import { useSettings } from '../store/settings';
import { useLauncher } from '../store/launcher';

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
      <button onClick={() => setPage('versions')} className="h-14 rounded-2xl bg-white/[0.06] px-8 text-[15px]">
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
        className="flex h-14 items-center gap-2 rounded-2xl bg-[var(--vx-accent)] px-8 text-[15px] font-medium text-black/80 disabled:opacity-50"
      >
        <Download size={18} /> {installing ? 'Установка…' : 'Установить'}
      </button>
    );
  } else {
    action = (
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => void play(selected, ramMb, javaPath)}
        className="flex h-14 items-center gap-2 rounded-2xl bg-[var(--vx-accent)] px-8 text-[15px] font-medium text-black/80"
      >
        <Play size={18} fill="currentColor" /> Играть
      </motion.button>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--vx-muted)]">Обзор</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Готовы к приключению?</h1>
      </motion.header>

      <Glass className="flex items-center justify-between gap-6 p-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--vx-muted)]">
            <ShieldCheck size={16} className="text-[var(--vx-accent)]" />
            {selected ? `Minecraft ${selected}` : 'Версия не выбрана'} · {isInstalled ? 'установлена' : 'не установлена'}
          </div>
          <p className="mt-2 max-w-md text-sm text-[var(--vx-muted)]">
            Файлы проверяются по SHA-1 при установке. Java берётся из настроек (по умолчанию «java» из PATH).
          </p>
        </div>
        {action}
      </Glass>

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
    </div>
  );
}
