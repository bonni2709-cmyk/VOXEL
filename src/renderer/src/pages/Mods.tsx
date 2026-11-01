import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Languages, Loader2, Search } from 'lucide-react';
import type { ModHit } from '@shared/types';
import { Glass } from '../components/Glass';
import { useSettings } from '../store/settings';

/** Заглушка для модов без иконки: градиент от названия (без внешних картинок). */
function placeholderStyle(seed: string): { background: string } {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return { background: `linear-gradient(135deg, hsl(${hue} 55% 38%), hsl(${(hue + 60) % 360} 50% 22%))` };
}

function ModCard({ hit, index, disabled, busy, onInstall }: {
  hit: ModHit; index: number; disabled: boolean; busy: boolean; onInstall: () => void;
}) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [tError, setTError] = useState<string | null>(null);

  async function translate() {
    setTranslating(true);
    setTError(null);
    const res = await window.voxel.translate.text(hit.description);
    setTranslating(false);
    if (res.ok && res.data) setTranslated(res.data);
    else setTError(res.error ?? 'Ошибка перевода');
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 12) * 0.04 }}
    >
      <Glass className="flex h-full flex-col gap-3 p-4 transition-transform hover:-translate-y-0.5">
        <div className="flex items-start gap-3">
          {hit.iconUrl ? (
            <img src={hit.iconUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-semibold text-white/80" style={placeholderStyle(hit.title)}>
              {hit.title.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-medium">{hit.title}</div>
            <div className="mt-0.5 text-[11px] text-[var(--vx-muted)]">{hit.downloads.toLocaleString('ru-RU')} загрузок</div>
          </div>
        </div>

        <p className="line-clamp-3 min-h-[3.6em] text-xs leading-relaxed text-[var(--vx-muted)]">{translated ?? hit.description}</p>
        {tError && <p className="text-[11px] text-red-400">{tError}</p>}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <button
            onClick={() => (translated ? setTranslated(null) : void translate())}
            disabled={translating || !hit.description}
            className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs disabled:opacity-40"
          >
            {translating ? <Loader2 size={13} className="animate-spin" /> : <Languages size={13} />}
            {translated ? 'Оригинал' : 'Перевести'}
          </button>
          <button
            disabled={disabled || busy}
            onClick={onInstall}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--vx-accent)] px-3 py-1.5 text-xs font-medium text-black/85 disabled:opacity-40"
          >
            <Download size={13} /> {busy ? '…' : 'Установить'}
          </button>
        </div>
      </Glass>
    </motion.div>
  );
}

export function Mods() {
  const id = useSettings((s) => s.selectedVersion);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ModHit[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deps, setDeps] = useState<{ kind: string; mod: string; message: string }[] | null>(null);

  const refresh = () => {
    if (!id) return;
    void window.voxel.mods.list(id).then((r) => r.ok && r.data && setInstalled(r.data));
  };
  useEffect(refresh, [id]);

  async function checkDeps() {
    if (!id) return;
    const res = await window.voxel.deps.resolve(id);
    if (res.ok && res.data) setDeps(res.data);
    else setError(res.error ?? 'Не удалось проверить зависимости');
  }

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
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--vx-muted)]">Modrinth</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Моды</h1>
      </header>

      {!id && <Glass className="p-6 text-sm text-[var(--vx-muted)]">Выберите версию в разделе «Версии игры».</Glass>}

      <form
        onSubmit={(e) => { e.preventDefault(); void search(); }}
        className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/25 px-3 py-2"
      >
        <Search size={15} className="text-[var(--vx-muted)]" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск модов Fabric…" className="w-full bg-transparent text-sm outline-none" />
        <button type="submit" disabled={!id} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm disabled:opacity-40">Найти</button>
      </form>

      {error && <Glass className="p-4 text-sm text-red-400">{error}</Glass>}
      {notice && <Glass className="p-4 text-sm text-[var(--vx-accent)]">{notice}</Glass>}

      {hits.length === 0 ? (
        <Glass className="px-5 py-10 text-center text-sm text-[var(--vx-muted)]">Введите запрос и нажмите «Найти».</Glass>
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {hits.map((h, i) => (
            <ModCard
              key={h.projectId}
              hit={h}
              index={i}
              disabled={!id}
              busy={busy === h.projectId}
              onInstall={() => void install(h)}
            />
          ))}
        </div>
      )}

      <Glass className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Dependency & Conflict Resolver</div>
          <button disabled={!id} onClick={() => void checkDeps()} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm disabled:opacity-40">Проверить</button>
        </div>
        {deps && deps.length === 0 && <p className="text-sm text-[var(--vx-accent)]">Конфликтов и пропущенных зависимостей не найдено.</p>}
        {deps?.map((d, i) => (
          <div key={i} className="text-sm">
            <span className={d.kind === 'conflict' || d.kind === 'missing' ? 'text-red-400' : 'text-amber-300'}>[{d.kind}]</span>{' '}
            <span className="font-mono text-[12px]">{d.mod}</span>: {d.message}
          </div>
        ))}
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
