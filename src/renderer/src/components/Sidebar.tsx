import { motion } from 'framer-motion';
import {
  Box, Cpu, Download, Gamepad2, Globe, Image, Package, Puzzle,
  Server, Settings, SquareTerminal, User, Home, Shirt,
} from 'lucide-react';
import type { PageId } from '@shared/types';
import { useSettings } from '../store/settings';
import { useT } from '../i18n';

const NAV: { id: PageId; icon: typeof Home }[] = [
  { id: 'overview', icon: Home },
  { id: 'versions', icon: Gamepad2 },
  { id: 'mods', icon: Puzzle },
  { id: 'modpacks', icon: Package },
  { id: 'java', icon: Cpu },
  { id: 'worlds', icon: Globe },
  { id: 'gallery', icon: Image },
  { id: 'downloads', icon: Download },
  { id: 'console', icon: SquareTerminal },
  { id: 'server', icon: Server },
  { id: 'skins', icon: Shirt },
  { id: 'profile', icon: User },
  { id: 'settings', icon: Settings },
];

export function Sidebar() {
  const page = useSettings((s) => s.page);
  const setPage = useSettings((s) => s.setPage);
  const t = useT();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-white/[0.05] bg-black/20 px-4 py-5 backdrop-blur-xl">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--vx-accent)]/15 text-[var(--vx-accent)]">
          <Box size={20} />
        </div>
        <div>
          <div className="text-[15px] font-semibold tracking-tight text-[var(--vx-text)]">VOXEL</div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--vx-muted)]">Launcher 4.0</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1 overflow-y-auto">
        {NAV.map(({ id, icon: Icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              onClick={() => setPage(id)}
              className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-white/[0.04]"
              style={{ color: active ? 'var(--vx-text)' : 'var(--vx-muted)' }}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl bg-[var(--vx-accent)]/12 ring-1 ring-[var(--vx-accent)]/25"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <Icon size={17} className="relative z-10" />
              <span className="relative z-10">{t(id)}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
