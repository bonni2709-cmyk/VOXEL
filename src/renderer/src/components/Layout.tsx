import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full bg-[var(--vx-bg)] text-[var(--vx-text)]">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-10 py-8">{children}</div>
      </main>
    </div>
  );
}
