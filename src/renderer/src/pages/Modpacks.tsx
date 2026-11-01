import { useEffect, useState } from 'react';
import type { ScriptToggle } from '@shared/types';
import { Glass } from '../components/Glass';
import { useSettings } from '../store/settings';

export function Modpacks() {
  const id = useSettings((s) => s.selectedVersion);
  const [scripts, setScripts] = useState<ScriptToggle[]>([]);
  const [includeScripts, setIncludeScripts] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadScripts = () => {
    if (!id) return;
    void window.voxel.scripts.list(id).then((r) => r.ok && r.data && setScripts(r.data));
  };
  useEffect(loadScripts, [id]);
  useEffect(() => window.voxel.on.packProgress((p) => setProgress({ done: p.done, total: p.total })), []);

  async function run(fn: () => Promise<{ ok: boolean; data?: string; error?: string }>) {
    setBusy(true);
    setError(null);
    setMsg(null);
    setProgress(null);
    const res = await fn();
    setBusy(false);
    if (res.ok) setMsg(res.data ?? 'Готово');
    else setError(res.error ?? 'Ошибка');
  }

  async function toggle(dir: string, enabled: boolean) {
    if (!id) return;
    await window.voxel.scripts.set(id, dir, enabled);
    loadScripts();
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--vx-muted)]">Сборки и обмен</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Модпаки</h1>
      </header>

      {!id && <Glass className="p-6 text-sm text-[var(--vx-muted)]">Выберите версию в разделе «Версии игры».</Glass>}
      {error && <Glass className="p-4 text-sm text-red-400">{error}</Glass>}
      {msg && <Glass className="p-4 text-sm text-[var(--vx-accent)]">{msg}</Glass>}
      {progress && busy && (
        <Glass className="p-4 text-sm">Импорт файлов: {progress.done} / {progress.total}</Glass>
      )}

      <Glass className="flex flex-col gap-4 p-6">
        <div className="text-sm font-medium">Скрипты KubeJS и CraftTweaker</div>
        {scripts.filter((s) => s.present).length === 0 && <p className="text-sm text-[var(--vx-muted)]">Скриптов в сборке нет.</p>}
        {scripts.filter((s) => s.present).map((s) => (
          <label key={s.dir} className="flex items-center justify-between text-sm">
            <span className="font-mono">{s.dir}/</span>
            <input type="checkbox" checked={s.enabled} onChange={(e) => void toggle(s.dir, e.target.checked)} className="accent-[var(--vx-accent)]" />
          </label>
        ))}
      </Glass>

      <Glass className="flex flex-col gap-4 p-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeScripts} onChange={(e) => setIncludeScripts(e.target.checked)} className="accent-[var(--vx-accent)]" />
          Включать скрипты в экспорт
        </label>
        <div className="flex flex-wrap gap-3">
          <button disabled={!id || busy} onClick={() => id && void run(() => window.voxel.pack.exportZip(id, includeScripts))} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm disabled:opacity-40">Экспорт ZIP</button>
          <button disabled={!id || busy} onClick={() => id && void run(() => window.voxel.pack.exportMrpack(id, includeScripts))} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm disabled:opacity-40">Экспорт .mrpack</button>
          <button disabled={!id || busy} onClick={() => id && void run(() => window.voxel.pack.import(id))} className="rounded-xl bg-[var(--vx-accent)] px-4 py-2 text-sm font-medium text-black/80 disabled:opacity-40">Импорт .mrpack</button>
        </div>
        <p className="text-[11px] text-[var(--vx-muted)]">
          Импорт ставит файлы из индекса с проверкой SHA-1 (только cdn.modrinth.com) и распаковывает overrides в папку выбранной версии.
          Логи, краш-репорты, бэкапы и скриншоты в экспорт не попадают.
        </p>
      </Glass>
    </div>
  );
}
