import type { ReactNode } from 'react';

/** Матовое стекло: полупрозрачная панель, blur 12px, тонкая светлая обводка и мягкая тень. */
export function Glass({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/5 bg-[var(--vx-panel)]/70 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-[12px] ${className}`}
    >
      {children}
    </div>
  );
}
