import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Download, Search } from 'lucide-react';
import type { VersionSummary } from '@shared/types';
import { Glass } from '../components/Glass';
import { useLauncher } from '../store/launcher';
import { useSettings } from '../store/settings';
import coverUrl from '../assets/hero.jpg';

type Tab = 'release' | 'snapshot' | 'installed';

const TABS: { id: Tab; label: string }[] = [
  { id: 'release', label: 'Релизы' },
  { id: 'snapshot', label: 'Snapshots' },
  { id: 'installed', label: 'Установленные' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function Versions() {
  const { versions, versionsLoading, versionsError, installed, installing, progress, loadVersions, refreshInstalled, install } = useLauncher();
  const selected = useSettings((s) => s.selectedVersion);
  const setSelected = useSettings((s) => s.setSelectedVersion);
  const [tab, setTab] = useState<Tab>('release');
  const [query, setQuery] = useState('');
  const [withFabric, setWithFabric] = useState(false);
  const [fabricBusy, setFabricBusy] = useState(false);
  const [fabricError, setFabricError] = useState<string | null>(null);

  useEffect(() => {
    void loadVersions();
    void refreshInstalled();
  }, [loadVersions, refreshInstalled]);

  const rows = useMemo<VersionSummary[]>(() => {
    const base = tab === 'installed'
      ? versions.filter((v) => installed.includes(v.id))
      : versions.filter((v) => (tab === 'release' ? v.type === 'release' : v.type === 'snapshot'));
    const q = query.trim().toLowerCase();
    return q ? base.filter((v) => v.id.toLowerCase().includes(q)) : base;
  }, [versions, installed, tab, query]);

  const selectedInstalled = selected !== null && installed.includes(selected);
  const busy = installing !== null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-24">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--vx-muted)]">Официальный каталог Mojang</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ваш мир. Ваша версия.</h1>
        </div>
        <button onClick={() => void loadVersions()} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm">Обновить</button>
      </header>

      <div className="relative h-36 overflow-hidden rounded-2xl border border-white/5">
        <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0F1115] via-[#0F1115]/40 to-transparent" />
        <div className="absolute bottom-4 left-5 text-xs uppercase tracking-[0.3em] text-white/70">Релизы · Снапшоты · Fabric</div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex rounded-xl bg-white/[0.04] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative rounded-lg px-4 py-1.5 text-sm"
              style={{ color: tab === t.id ? 'var(--vx-text)' : 'var(--vx-muted)' }}
            >
              {tab === t.id && (
                <motion.span layoutId="tab-active" className="absolute inset-0 rounded-lg bg-white/[0.08]" />
              )}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>
        <label className="flex w-64 items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2">
          <Search size={14} className="text-[var(--vx-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти версию…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      {versionsError && <Glass className="p-4 text-sm text-red-400">{versionsError}</Glass>}
      {fabricError && <Glass className="p-4 text-sm text-red-400">{fabricError}</Glass>}
      {versionsLoading && <p className="text-sm text-[var(--vx-muted)]">Загрузка каталога…</p>}

      <Glass className="divide-y divide-white/[0.05] overflow-hidden">
        {rows.map((v) => {
          const isInstalled = installed.includes(v.id);
          const isSelected = selected === v.id;
          return (
            <div key={v.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="w-40 font-mono text-[15px]">{v.id}</div>
              <div className="w-40 text-sm text-[var(--vx-muted)]">{formatDate(v.releaseTime)}</div>
              <div className="flex-1 text-sm">
                {isInstalled ? <span className="text-[var(--vx-accent)]">Установлена</span> : <span className="text-[var(--vx-muted)]">Не установлена</span>}
              </div>
              <button
                onClick={() => setSelected(v.id)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm"
                style={{ color: isSelected ? 'var(--vx-accent)' : 'var(--vx-muted)' }}
              >
                {isSelected ? <><Check size={14} /> Выбрана</> : 'Выбрать'}
              </button>
            </div>
          );
        })}
        {!versionsLoading && rows.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-[var(--vx-muted)]">Ничего не найдено.</div>
        )}
      </Glass>

      <div className="fixed bottom-6 left-[15.5rem] right-10">
        <Glass className="flex items-center justify-between gap-4 px-6 py-4">
          <div className="text-sm">
            <span className="text-[var(--vx-muted)]">Выбрана </span>
            <span className="font-mono">{selected ?? '—'}</span>
            {progress && installing && (
              <span className="ml-3 text-xs text-[var(--vx-muted)]">
                {progress.stage} · {progress.done}/{progress.total}
              </span>
            )}
          </div>
          <button
            disabled={!selected || busy || fabricBusy || selectedInstalled}
            onClick={() => selected && void (async () => {
              if (!withFabric) return install(selected);
              setFabricBusy(true);
              setFabricError(null);
              const res = await window.voxel.fabric.install(selected);
              setFabricBusy(false);
              if (res.ok && res.data) {
                setSelected(res.data);
                await refreshInstalled();
              } else setFabricError(res.error ?? 'Ошибка установки Fabric');
            })()}
            className="flex items-center gap-2 rounded-xl bg-[var(--vx-accent)] px-5 py-2.5 text-sm font-medium text-black/80 disabled:opacity-40"
          >
            <Download size={15} />
            {busy || fabricBusy ? 'Установка…' : selectedInstalled ? 'Уже установлена' : withFabric ? 'Установить Fabric' : 'Установить'}
          </button>
          <label className="flex items-center gap-2 text-sm text-[var(--vx-muted)]">
            <input type="checkbox" checked={withFabric} onChange={(e) => setWithFabric(e.target.checked)} className="accent-[var(--vx-accent)]" />
            Fabric
          </label>
        </Glass>
      </div>
    </div>
  );
}
