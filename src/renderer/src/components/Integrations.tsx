import { useEffect, useState } from 'react';
import { Glass } from './Glass';
import { useSettings } from '../store/settings';

const SECRET_FIELDS = [
  { name: 'groqKey', label: 'Groq API key (AI Modpack Builder)', placeholder: 'gsk_…' },
  { name: 'mistralKey', label: 'Mistral API key (запасной провайдер)', placeholder: '' },
  { name: 'discordAppId', label: 'Discord Application ID (Rich Presence)', placeholder: '1234567890123456789' },
] as const;

/** Ключи хранятся в main-процессе, в зашифрованном виде. В интерфейсе показывается только факт наличия. */
export function Integrations() {
  const proxy = useSettings((s) => s.proxy);
  const mirror = useSettings((s) => s.mirror);
  const setNetwork = useSettings((s) => s.setNetwork);
  const [draftProxy, setDraftProxy] = useState(proxy);
  const [draftMirror, setDraftMirror] = useState(mirror);
  const [netMsg, setNetMsg] = useState<string | null>(null);
  const [has, setHas] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});

  const refreshHas = () => {
    void Promise.all(SECRET_FIELDS.map(async (f) => [f.name, await window.voxel.secrets.has(f.name)] as const))
      .then((entries) => setHas(Object.fromEntries(entries)));
  };
  useEffect(refreshHas, []);

  async function applyNetwork() {
    setNetMsg(null);
    const res = await window.voxel.shield.set({ proxy: draftProxy, mirror: draftMirror });
    if (res.ok) {
      setNetwork(draftProxy, draftMirror);
      setNetMsg('Сохранено. Порядок: прямое → прокси → зеркало (Microsoft и Xbox без запасных маршрутов).');
    } else setNetMsg(res.error ?? 'Ошибка');
  }

  async function saveSecret(name: string) {
    const value = values[name] ?? '';
    const res = await window.voxel.secrets.set(name, value);
    setMsg((m) => ({ ...m, [name]: res.ok ? (value ? 'Сохранено' : 'Удалено') : (res.error ?? 'Ошибка') }));
    setValues((v) => ({ ...v, [name]: '' }));
    refreshHas();
  }

  return (
    <>
      <Glass className="flex flex-col gap-4 p-6">
        <div>
          <div className="text-sm font-medium">Network Shield</div>
          <div className="mt-0.5 text-[11px] text-[var(--vx-muted)]">Запасные маршруты для загрузок. Таймаут ответа — 15 с.</div>
        </div>
        <label className="flex flex-col gap-1.5 text-xs text-[var(--vx-muted)]">
          Прокси пользователя (CONNECT), например http://127.0.0.1:8080
          <input value={draftProxy} onChange={(e) => setDraftProxy(e.target.value)} className="rounded-xl border border-white/5 bg-black/25 px-4 py-2 font-mono text-sm text-[var(--vx-text)] outline-none" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-[var(--vx-muted)]">
          Зеркало (https), заменяет домен файла, путь сохраняется
          <input value={draftMirror} onChange={(e) => setDraftMirror(e.target.value)} className="rounded-xl border border-white/5 bg-black/25 px-4 py-2 font-mono text-sm text-[var(--vx-text)] outline-none" />
        </label>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--vx-accent)]">{netMsg}</span>
          <button onClick={() => void applyNetwork()} className="rounded-xl bg-[var(--vx-accent)] px-4 py-2 text-sm font-medium text-black/85">Применить</button>
        </div>
      </Glass>

      <Glass className="flex flex-col gap-5 p-6">
        <div className="text-sm font-medium">Ключи и интеграции</div>
        {SECRET_FIELDS.map((f) => (
          <div key={f.name} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-[var(--vx-muted)]">
              <span>{f.label}</span>
              <span>{has[f.name] ? '● сохранён' : '○ не задан'}</span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={values[f.name] ?? ''}
                placeholder={f.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                className="w-full rounded-xl border border-white/5 bg-black/25 px-4 py-2 font-mono text-sm outline-none focus:border-[var(--vx-accent)]/60"
              />
              <button onClick={() => void saveSecret(f.name)} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm">Сохранить</button>
            </div>
            {msg[f.name] && <span className="text-[11px] text-[var(--vx-muted)]">{msg[f.name]}</span>}
          </div>
        ))}
        <span className="text-[11px] text-[var(--vx-muted)]">Пустое поле и «Сохранить» — удалить ключ.</span>
      </Glass>
    </>
  );
}
