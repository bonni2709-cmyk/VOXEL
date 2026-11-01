import { useEffect, useRef } from 'react';
import type { LogLevel } from '@shared/types';
import { Glass } from '../components/Glass';
import { useLauncher } from '../store/launcher';

const COLORS: Record<LogLevel, string> = {
  info: 'var(--vx-muted)',
  java: 'var(--vx-text)',
  warn: '#E8B86D',
  error: '#E8838A',
  success: '#6FD3A4',
};

export function Console() {
  const logs = useLauncher((s) => s.logs);
  const clearLogs = useLauncher((s) => s.clearLogs);
  const running = useLauncher((s) => s.running);
  const lastExit = useLauncher((s) => s.lastExit);
  const stop = useLauncher((s) => s.stop);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [logs.length]);

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--vx-muted)]">Под капотом</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Консоль</h1>
        </div>
        <div className="flex gap-2">
          {running && (
            <button onClick={() => void stop()} className="rounded-xl bg-red-500/15 px-4 py-2 text-sm text-red-300">Остановить</button>
          )}
          <button onClick={clearLogs} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm">Очистить</button>
        </div>
      </header>

      {lastExit?.findings && lastExit.findings.length > 0 && (
        <Glass className="flex flex-col gap-3 p-5">
          <div className="text-sm font-medium">Crash Analyzer · найдено проблем: {lastExit.findings.length}</div>
          {lastExit.findings.map((f, i) => (
            <div key={i} className="rounded-xl bg-red-500/[0.06] p-3">
              <div className="text-sm text-red-300">{f.title}</div>
              <div className="mt-1 text-xs text-[var(--vx-muted)]">{f.hint}</div>
              <div className="mt-2 break-all font-mono text-[11px] text-[var(--vx-muted)]">{f.line}</div>
            </div>
          ))}
        </Glass>
      )}

      <Glass className="min-h-[50vh] flex-1 overflow-y-auto p-4 font-mono text-[12px] leading-relaxed">
        {logs.length === 0 && <div className="text-[var(--vx-muted)]">Лог пуст. Запустите игру, чтобы увидеть вывод Java.</div>}
        {logs.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            <span className="text-[var(--vx-muted)]">{l.time}</span>{' '}
            <span style={{ color: COLORS[l.level] }}>{l.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </Glass>
    </div>
  );
}
