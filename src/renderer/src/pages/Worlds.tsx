import { useEffect, useState } from 'react';
import type { WorldInfo } from '@shared/types';
import { Glass } from '../components/Glass';
import { useSettings } from '../store/settings';
import type { WorldMap } from '@shared/types';

function formatSize(bytes: number): string {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

export function Worlds() {
  const id = useSettings((s) => s.selectedVersion);
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maps, setMaps] = useState<Record<string, WorldMap | null>>({});

  async function loadMap(name: string) {
    if (!id) return;
    const r = await window.voxel.map.world(id, name);
    setMaps((m) => ({ ...m, [name]: r.ok && r.data ? r.data : null }));
    if (!r.ok) setError(r.error ?? 'Не удалось прочитать карту');
  }

  const load = () => {
    if (!id) return;
    void window.voxel.worlds.list(id).then((r) => {
      if (r.ok && r.data) setWorlds(r.data);
      else setError(r.error ?? 'Не удалось прочитать миры');
    });
  };
  useEffect(load, [id]);

  async function backup(world: string) {
    if (!id) return;
    setError(null);
    setMessage(null);
    const res = await window.voxel.worlds.backup(id, world);
    if (res.ok) setMessage(`Бэкап создан: ${res.data}`);
    else setError(res.error ?? 'Ошибка бэкапа');
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--vx-muted)]">Ваши приключения не теряются</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Миры этой сборки</h1>
        </div>
        <button onClick={load} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm">Обновить</button>
      </header>

      {!id && <Glass className="p-6 text-sm text-[var(--vx-muted)]">Выберите версию в разделе «Версии игры».</Glass>}
      {error && <Glass className="p-4 text-sm text-red-400">{error}</Glass>}
      {message && <Glass className="p-4 text-sm text-[var(--vx-accent)]">{message}</Glass>}

      {id && worlds.length === 0 && !error && (
        <Glass className="p-6 text-sm text-[var(--vx-muted)]">Миров пока нет. Создайте мир в игре, он появится здесь.</Glass>
      )}

      {worlds.map((w) => (
        <Glass key={w.name} className="flex flex-col p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[15px]">{w.name}</div>
            <div className="mt-1 text-xs text-[var(--vx-muted)]">
              {new Date(w.lastPlayed).toLocaleString('ru-RU')} · {formatSize(w.sizeBytes)}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void loadMap(w.name)} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm">Карта</button>
            <button onClick={() => void backup(w.name)} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm">Сделать бэкап</button>
          </div>
        </div>
        {maps[w.name] !== undefined && (
          <div className="border-t border-white/5 px-5 py-3 text-[12px] text-[var(--vx-muted)]">
            {maps[w.name] === null ? 'Карта не прочитана' : maps[w.name]!.regions.length === 0
              ? 'Регионов ещё нет: территория не сгенерирована (папка region отсутствует)'
              : `Регионов: ${maps[w.name]!.regions.length} · сгенерированных чанков: ${maps[w.name]!.totalChunks}`}
          </div>
        )}
        </Glass>
      ))}
    </div>
  );
}
