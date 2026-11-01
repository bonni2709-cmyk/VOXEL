import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { ACCENT_RE, THEME_IDS, type ThemeId } from '@shared/types';
import { Glass } from '../components/Glass';
import { PALETTES, applyTheme } from '../theme';
import { useSettings } from '../store/settings';

export function Settings() {
  const theme = useSettings((s) => s.theme);
  const accent = useSettings((s) => s.accent);
  const setTheme = useSettings((s) => s.setTheme);
  const setAccent = useSettings((s) => s.setAccent);
  const windowWidth = useSettings((s) => s.windowWidth);
  const windowHeight = useSettings((s) => s.windowHeight);
  const setWindow = useSettings((s) => s.setWindow);
  const [hexDraft, setHexDraft] = useState(accent ?? '');
  const [hexError, setHexError] = useState<string | null>(null);

  function pickTheme(id: ThemeId) {
    setTheme(id);
    applyTheme(id, accent);
  }

  function applyHex() {
    const value = hexDraft.trim();
    if (!ACCENT_RE.test(value)) {
      setHexError('Формат: #RRGGBB');
      return;
    }
    setHexError(null);
    setAccent(value);
    applyTheme(theme, value);
  }

  function resetAccent() {
    setAccent(null);
    setHexDraft('');
    setHexError(null);
    applyTheme(theme, null);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--vx-muted)]">Настройки</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ваш лаунчер</h1>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {THEME_IDS.map((id) => {
          const p = PALETTES[id];
          const active = theme === id;
          return (
            <motion.button
              key={id}
              whileHover={{ y: -2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={() => pickTheme(id)}
              className={`relative rounded-2xl border p-3 text-left transition-colors ${
                active ? 'border-[var(--vx-accent)]/70' : 'border-white/[0.06]'
              }`}
              style={{ background: p.panel }}
            >
              <div className="mb-3 h-16 rounded-lg" style={{ background: p.bg }}>
                <div className="m-2 h-2 w-2/3 rounded" style={{ background: p.accent }} />
                <div className="mx-2 h-2 w-1/2 rounded opacity-40" style={{ background: p.muted }} />
              </div>
              <div className="text-sm font-medium" style={{ color: p.text }}>{p.label}</div>
              <div className="text-[11px]" style={{ color: p.muted }}>{p.caption}</div>
              {active && <Check size={14} className="absolute right-3 top-3" style={{ color: p.accent }} />}
            </motion.button>
          );
        })}
      </section>

      <Glass className="flex flex-col gap-4 p-6">
        <span className="text-sm font-medium">Акцент интерфейса</span>
        <div className="flex items-center gap-3">
          <input
            value={hexDraft}
            placeholder="#92bcf8"
            onChange={(e) => setHexDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyHex()}
            className="w-40 rounded-xl border border-white/[0.08] bg-black/25 px-4 py-2 font-mono text-sm outline-none focus:border-[var(--vx-accent)]/60"
          />
          <button onClick={applyHex} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm">Применить</button>
          <button onClick={resetAccent} className="text-sm text-[var(--vx-muted)] underline underline-offset-4">
            Вернуть акцент темы
          </button>
        </div>
        {hexError && <span className="text-[11px] text-red-400">{hexError}</span>}
      </Glass>

      <Glass className="flex items-center gap-4 p-6">
        <span className="text-sm">Размер игрового окна</span>
        <input
          type="number" min={640} value={windowWidth}
          onChange={(e) => setWindow(Number(e.target.value), windowHeight)}
          className="w-24 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 font-mono text-sm outline-none"
        />
        <span className="text-[var(--vx-muted)]">×</span>
        <input
          type="number" min={480} value={windowHeight}
          onChange={(e) => setWindow(windowWidth, Number(e.target.value))}
          className="w-24 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 font-mono text-sm outline-none"
        />
      </Glass>
    </div>
  );
}
