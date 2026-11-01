import { useEffect, useState } from 'react';
import { Download, Check } from 'lucide-react';
import { Glass } from '../components/Glass';

const MAJORS = [
  { major: 8, note: 'Классические сборки' },
  { major: 17, note: 'Сборки с Java 17' },
  { major: 21, note: 'Современные сборки' },
  { major: 25, note: 'Minecraft 26.3 требует Java 25' },
];

export function JavaManager() {
  const [installed, setInstalled] = useState<number[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => void window.voxel.java.status().then(setInstalled);
  useEffect(refresh, []);

  async function install(major: number) {
    setBusy(major);
    setError(null);
    const res = await window.voxel.java.install(major);
    setBusy(null);
    if (!res.ok) setError(res.error ?? 'Ошибка установки Java');
    refresh();
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--vx-muted)]">Правильная среда</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Java Manager</h1>
        <p className="mt-2 text-sm text-[var(--vx-muted)]">Temurin от Eclipse Adoptium. Архив проверяется по SHA-256 из API.</p>
      </header>

      {error && <Glass className="p-4 text-sm text-red-400">{error}</Glass>}

      <div className="grid grid-cols-2 gap-4">
        {MAJORS.map(({ major, note }) => {
          const ok = installed.includes(major);
          return (
            <Glass key={major} className="flex flex-col gap-4 p-6">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] tracking-widest text-[var(--vx-muted)]">TEMURIN</span>
                <span className="text-xs text-[var(--vx-muted)]">{ok ? 'Установлена' : 'Не установлена'}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-light">{major}</span>
                <span className="text-[var(--vx-muted)]">Java</span>
              </div>
              <p className="text-sm text-[var(--vx-muted)]">{note}</p>
              <button
                disabled={busy !== null || ok}
                onClick={() => void install(major)}
                className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-[var(--vx-accent)] py-2.5 text-sm font-medium text-black/80 disabled:opacity-50"
              >
                {ok ? <><Check size={15} /> Готова</> : <><Download size={15} /> {busy === major ? 'Скачивание…' : `Скачать Java ${major}`}</>}
              </button>
            </Glass>
          );
        })}
      </div>
    </div>
  );
}
