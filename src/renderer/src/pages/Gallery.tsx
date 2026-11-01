import { useEffect, useState } from 'react';
import type { GalleryItem } from '@shared/types';
import { Glass } from '../components/Glass';
import { useSettings } from '../store/settings';

export function Gallery() {
  const id = useSettings((s) => s.selectedVersion);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!id) return;
    void window.voxel.gallery.list(id).then((r) => {
      if (r.ok && r.data) setItems(r.data);
      else setError(r.error ?? 'Не удалось загрузить галерею');
    });
  };
  useEffect(load, [id]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--vx-muted)]">Истории в одном кадре</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Галерея</h1>
        </div>
        <button onClick={load} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm">Обновить</button>
      </header>

      {!id && <Glass className="p-6 text-sm text-[var(--vx-muted)]">Выберите версию в разделе «Версии игры».</Glass>}
      {error && <Glass className="p-4 text-sm text-red-400">{error}</Glass>}
      {id && items.length === 0 && !error && (
        <Glass className="p-6 text-sm text-[var(--vx-muted)]">Первый кадр ещё впереди. Нажмите F2 в Minecraft — скриншот появится здесь.</Glass>
      )}

      <div className="grid grid-cols-3 gap-4">
        {items.map((it) => (
          <Glass key={it.name} className="overflow-hidden p-2">
            <img src={it.dataUrl} alt={it.name} className="aspect-video w-full rounded-xl object-cover" />
            <div className="truncate px-1 pt-2 text-[11px] text-[var(--vx-muted)]">{it.name}</div>
          </Glass>
        ))}
      </div>
    </div>
  );
}
