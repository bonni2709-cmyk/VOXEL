import type { ReactNode } from 'react';

/** Матовое стекло: полупрозрачная панель с мягкой тенью и тонкой обводкой. */
export function Glass({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.06] bg-[var(--vx-panel)]/80 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}
