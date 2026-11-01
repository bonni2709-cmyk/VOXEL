import { useEffect, useState } from 'react';
import type { OfflineProfile } from '@shared/types';
import { NICK_RE } from '@shared/types';
import { Glass } from '../components/Glass';

export function Profile() {
  const [profile, setProfile] = useState<OfflineProfile | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void window.voxel.profile.get().then((p) => {
      setProfile(p);
      setDraft(p.name);
    });
  }, []);

  const valid = NICK_RE.test(draft.trim());

  async function save() {
    const res = await window.voxel.profile.setName(draft);
    if (res.ok && res.data) {
      setProfile(res.data);
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } else {
      setError(res.error ?? 'Не удалось сохранить.');
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--vx-muted)]">Профиль</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ваш образ</h1>
      </header>

      <Glass className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-[var(--vx-muted)]">Microsoft-аккаунт (Java Edition)</div>
            <p className="mt-1 text-xs text-[var(--vx-muted)]">Вход через Microsoft появится позже.</p>
          </div>
          <button disabled className="rounded-xl bg-white/[0.05] px-4 py-2 text-sm opacity-50">
            Войти с Microsoft
          </button>
        </div>
      </Glass>

      <Glass className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Офлайн-профиль</span>
          <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] tracking-widest text-[var(--vx-muted)]">
            OFFLINE
          </span>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-[var(--vx-muted)]">Имя игрока</span>
          <input
            value={draft}
            maxLength={16}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            className="rounded-xl border border-white/[0.08] bg-black/25 px-4 py-2.5 outline-none focus:border-[var(--vx-accent)]/60"
          />
          <span className={`text-[11px] ${error ? 'text-red-400' : 'text-[var(--vx-muted)]'}`}>
            {error ?? '3–16 символов: латиница, цифры и «_».'}
          </span>
        </label>

        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-[var(--vx-muted)]">UUID: {profile?.uuid ?? '—'}</span>
          <button
            onClick={save}
            disabled={!valid || draft.trim() === profile?.name}
            className="rounded-xl bg-[var(--vx-accent)] px-5 py-2 text-sm font-medium text-black/80 disabled:opacity-40"
          >
            {saved ? 'Сохранено' : 'Сохранить имя'}
          </button>
        </div>
      </Glass>
    </div>
  );
}
