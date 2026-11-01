import { useEffect, useState } from 'react';
import type { AccountView, OfflineProfile } from '@shared/types';
import { NICK_RE } from '@shared/types';
import { Glass } from '../components/Glass';
import { useSettings } from '../store/settings';

export function Profile() {
  const msClientId = useSettings((s) => s.msClientId);
  const setMsClientId = useSettings((s) => s.setMsClientId);
  const [account, setAccount] = useState<AccountView | null>(null);
  const [profile, setProfile] = useState<OfflineProfile | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = () => void window.voxel.auth.status().then(setAccount);

  useEffect(() => {
    void window.voxel.profile.get().then((p) => {
      setProfile(p);
      setDraft(p.name);
    });
    refresh();
  }, []);

  const valid = NICK_RE.test(draft.trim());

  async function save() {
    const res = await window.voxel.profile.setName(draft);
    if (res.ok && res.data) {
      setProfile(res.data);
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      refresh();
    } else {
      setError(res.error ?? 'Не удалось сохранить.');
    }
  }

  async function signIn() {
    setBusy(true);
    setAuthError(null);
    const res = await window.voxel.auth.signIn(msClientId);
    setBusy(false);
    if (res.ok && res.data) setAccount(res.data);
    else setAuthError(res.error ?? 'Не удалось войти');
  }

  async function signOut() {
    await window.voxel.auth.signOut();
    refresh();
  }

  const isMs = account?.kind === 'microsoft';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--vx-muted)]">Профиль</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ваш образ</h1>
      </header>

      <Glass className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Microsoft-аккаунт (Java Edition)</div>
            <p className="mt-1 text-xs text-[var(--vx-muted)]">
              {isMs ? `Вход выполнен: ${account?.name}` : 'Вход через OAuth Microsoft. Токен хранится в зашифрованном виде.'}
            </p>
          </div>
          {isMs ? (
            <button onClick={() => void signOut()} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm">Выйти</button>
          ) : (
            <button
              onClick={() => void signIn()}
              disabled={busy || !msClientId}
              className="rounded-xl bg-[var(--vx-accent)] px-4 py-2 text-sm font-medium text-black/80 disabled:opacity-40"
            >
              {busy ? 'Ожидание входа…' : 'Войти с Microsoft'}
            </button>
          )}
        </div>
        {!msClientId && (
          <p className="text-[11px] text-[var(--vx-muted)]">
            Нужен Azure Client ID приложения. Укажите его ниже в «Аккаунт Microsoft».
          </p>
        )}
        {authError && <p className="text-[11px] text-red-400">{authError}</p>}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-[var(--vx-muted)]">Azure Client ID</span>
          <input
            value={msClientId}
            onChange={(e) => setMsClientId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="rounded-xl border border-white/[0.08] bg-black/25 px-4 py-2 font-mono text-sm outline-none focus:border-[var(--vx-accent)]/60"
          />
        </label>
      </Glass>

      <Glass className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Офлайн-профиль</span>
          <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] tracking-widest text-[var(--vx-muted)]">OFFLINE</span>
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
