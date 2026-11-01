import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useSettings } from '../store/settings';

export function Layout({ children }: { children: ReactNode }) {
  const background = useSettings((s) => s.background);
  return (
    <div className="relative flex h-full bg-[var(--vx-bg)] text-[var(--vx-text)]">
      {background && (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-40"
            style={{ backgroundImage: `url(${background})` }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[var(--vx-bg)]/70" />
        </>
      )}
      <div className="relative flex h-full w-full">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-10 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
