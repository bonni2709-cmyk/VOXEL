import { useState } from 'react';
import { Sparkles, Download } from 'lucide-react';
import type { AiPick } from '@shared/types';
import { Glass } from './Glass';

/** AI Modpack Builder: LLM предлагает моды, каждый проверен в Modrinth. Выбранные ставятся в версию. */
export function AiBuilder({ versionId }: { versionId: string | null }) {
  const [text, setText] = useState('Хочу сборку на магию и технологии');
  const [provider, setProvider] = useState<'groq' | 'mistral'>('groq');
  const [picks, setPicks] = useState<AiPick[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function build() {
    if (!versionId) return;
    setBusy(true);
    setError(null);
    setDone(null);
    const res = await window.voxel.ai.modpack(provider, text, versionId);
    setBusy(false);
    if (res.ok && res.data) {
      setPicks(res.data);
      setSelected(new Set(res.data.map((p) => p.hit.projectId)));
    } else {
      setPicks([]);
      setError(res.error ?? 'Ошибка генерации');
    }
  }

  async function installSelected() {
    if (!versionId) return;
    setBusy(true);
    const names: string[] = [];
    const failed: string[] = [];
    for (const p of picks.filter((x) => selected.has(x.hit.projectId))) {
      const r = await window.voxel.mods.install(versionId, p.hit.projectId);
      (r.ok ? names : failed).push(p.hit.title);
    }
    setBusy(false);
    setDone(`Установлено: ${names.length}${failed.length ? `, ошибки: ${failed.join(', ')}` : ''}`);
  }

  return (
    <Glass className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-2 text-sm font-medium"><Sparkles size={15} className="text-[var(--vx-accent)]" /> AI Modpack Builder</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Например: хочу сборку на магию и технологии, без тяжёлых шейдеров"
        className="rounded-xl border border-white/5 bg-black/25 px-4 py-2 text-sm outline-none focus:border-[var(--vx-accent)]/60"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select value={provider} onChange={(e) => setProvider(e.target.value as 'groq' | 'mistral')} className="rounded-xl border border-white/5 bg-black/25 px-3 py-2 text-sm outline-none">
          <option value="groq">Groq</option>
          <option value="mistral">Mistral</option>
        </select>
        <button disabled={busy || !versionId} onClick={() => void build()} className="rounded-xl bg-[var(--vx-accent)] px-4 py-2 text-sm font-medium text-black/85 disabled:opacity-40">
          {busy ? 'Думаю…' : 'Собрать список'}
        </button>
        <span className="text-[11px] text-[var(--vx-muted)]">Нужен ключ API провайдера в Настройках.</span>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {picks.length > 0 && (
        <div className="flex flex-col gap-2">
          {picks.map((p) => (
            <label key={p.hit.projectId} className="flex items-start gap-3 rounded-xl bg-black/20 p-3">
              <input
                type="checkbox"
                className="mt-1 accent-[var(--vx-accent)]"
                checked={selected.has(p.hit.projectId)}
                onChange={(e) => setSelected((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) next.add(p.hit.projectId); else next.delete(p.hit.projectId);
                  return next;
                })}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm">{p.hit.title}</div>
                <div className="text-[12px] text-[var(--vx-muted)]">{p.reason}</div>
              </div>
            </label>
          ))}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[12px] text-[var(--vx-accent)]">{done}</span>
            <button disabled={busy || selected.size === 0} onClick={() => void installSelected()} className="flex items-center gap-2 rounded-xl bg-white/[0.08] px-4 py-2 text-sm disabled:opacity-40">
              <Download size={14} /> Установить выбранные ({selected.size})
            </button>
          </div>
        </div>
      )}
    </Glass>
  );
}
