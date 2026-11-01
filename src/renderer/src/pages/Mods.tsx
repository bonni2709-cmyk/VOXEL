import { useEffect, useState } from 'react';
import { Download, Search } from 'lucide-react';
import type { ModHit } from '@shared/types';
import { Glass } from '../components/Glass';
import { useSettings } from '../store/settings';

export function Mods() {
  const id = useSettings((s) => s.selectedVersion);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ModHit[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => {
    if (!id) return;
    void window.voxel.mods.list(id).then((r) => r.ok && r.data && setInstalled(r.data));
  };
  useEffect(refresh, [id]);

  async function search() {
    if (!id) return;
    setError(null);
    const res = await window.voxel.mods.search(query, id);
    if (res.ok && res.data) setHits(res.data);
    else setError(res.error ?? 'Ошибка поиска');
  }

  async function install(hit: ModHit) {
    if (!id) return;
    setBusy(hit.projectId);
    setError(null);
    setNotice(null);
    const res = await window.voxel.mods.install(id, hit.projectId);
    setBusy(null);
    if (res.ok) {
      setNotice(`Установлено: ${res.data}. Зависимости ставятся вручную — проверьте Dependency Resolver.`);
      refresh();
    } else setError(res.error ?? 'Не удалось установить мод');
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--vx-muted)]">Modrinth</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Моды</h1>
      </header>

      {!id && <Glass className="p-6 text-sm text-[var(--vx-muted)]">Выберите версию в разделе «Версии игры».</Glass>}

      <form
        onSubmit={(e) => { e.preventDefault(); void search(); }}
        className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2"
      >
        <Search size={15} className="text-[var(--vx-muted)]" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск модов Fabric…" className="w-full bg-transparent text-sm outline-none" />
        <button type="submit" disabled={!id} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm disabled:opacity-40">Найти</button>
      </form>

      {error && <Glass className="p-4 text-sm text-red-400">{error}</Glass>}
      {notice && <Glass className="p-4 text-sm text-[var(--vx-accent)]">{notice}</Glass>}

      <Glass className="divide-y divide-white/[0.05] overflow-hidden">
        {hits.map((h) => (
          <div key={h.projectId} className="flex items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="text-[15px]">{h.title}</div>
              <div className="truncate text-xs text-[var(--vx-muted)]">{h.description}</div>
              <div className="mt-1 text-[11px] text-[var(--vx-muted)]">{h.downloads.toLocaleString('ru-RU')} загрузок</div>
            </div>
            <button
              disabled={busy !== null || !id}
              onClick={() => void install(h)}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--vx-accent)] px-3 py-1.5 text-sm font-medium text-black/80 disabled:opacity-40"
            >
              <Download size={14} /> {busy === h.projectId ? '…' : 'Установить'}
            </button>
          </div>
        ))}
        {hits.length === 0 && <div className="px-5 py-8 text-center text-sm text-[var(--vx-muted)]">Введите запрос и нажмите «Найти».</div>}
      </Glass>

      <Glass className="p-5">
        <div className="mb-2 text-sm font-medium">Установлено в сборке · {installed.length}</div>
        {installed.length === 0 ? <p className="text-sm text-[var(--vx-muted)]">Модов пока нет.</p> : (
          <ul className="flex flex-col gap-1 font-mono text-[12px]">{installed.map((n) => <li key={n}>{n}</li>)}</ul>
        )}
      </Glass>
    </div>
  );
}
