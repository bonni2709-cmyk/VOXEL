import { useEffect, useRef, useState } from 'react';
import type { LogLine, ServerStatus } from '@shared/types';
import { Glass } from '../components/Glass';
import { useSettings } from '../store/settings';

const TYPES: { id: string; label: string; ok: boolean }[] = [
  { id: 'vanilla', label: 'Vanilla', ok: true },
  { id: 'paper', label: 'Paper', ok: true },
  { id: 'fabric', label: 'Fabric', ok: true },
  { id: 'forge', label: 'Forge', ok: false },
];

const LEVEL_COLOR: Record<string, string> = {
  error: 'text-red-400', warn: 'text-amber-300', success: 'text-emerald-400', info: 'text-sky-300', java: 'text-[var(--vx-text)]',
};

export function Server() {
  const ramMb = useSettings((s) => s.ramMb);
  const javaPath = useSettings((s) => s.javaPath);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [type, setType] = useState('vanilla');
  const [mc, setMc] = useState('1.21.1');
  const [motd, setMotd] = useState('VOXEL server');
  const [port, setPort] = useState(25565);
  const [onlineMode, setOnlineMode] = useState(true);
  const [backup, setBackup] = useState<ServerStatus['backup']>('off');
  const [lines, setLines] = useState<LogLine[]>([]);
  const [cmd, setCmd] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const [publicAddr, setPublicAddr] = useState<string | null>(null);

  const refresh = () => void window.voxel.server.status().then((s) => {
    setStatus(s);
    setMotd(s.motd);
    setPort(s.port);
    setOnlineMode(s.onlineMode);
    setBackup(s.backup);
  });

  useEffect(() => {
    refresh();
    const offLog = window.voxel.on.serverLog((l) => setLines((prev) => [...prev.slice(-1999), l]));
    const offExit = window.voxel.on.serverExit(() => refresh());
    return () => { offLog(); offExit(); };
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    setBusy(true);
    setMsg(null);
    const res = await fn();
    setBusy(false);
    setMsg(res.ok ? ok : (res.error ?? 'Ошибка'));
    refresh();
  }

  const offlineWarn = status && !status.onlineMode;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--vx-muted)]">Server Manager Pro</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Свой сервер</h1>
      </header>

      {msg && <Glass className="p-4 text-sm text-[var(--vx-accent)]">{msg}</Glass>}
      {offlineWarn && (
        <Glass className="p-4 text-sm text-amber-300">
          Offline-mode: любой игрок может зайти под чужим ником. Включайте только в закрытой сети.
        </Glass>
      )}

      <Glass className="flex flex-col gap-4 p-6">
        <div className="text-sm font-medium">Установка</div>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.id}
              disabled={!t.ok}
              onClick={() => setType(t.id)}
              className={`rounded-xl px-4 py-2 text-sm disabled:opacity-40 ${type === t.id ? 'bg-[var(--vx-accent)] text-black/80' : 'bg-white/[0.06]'}`}
            >
              {t.label}{!t.ok && ' · скоро'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input value={mc} onChange={(e) => setMc(e.target.value.trim())} className="w-40 rounded-xl border border-white/[0.08] bg-black/25 px-4 py-2 font-mono text-sm outline-none" />
          <button
            disabled={busy}
            onClick={() => void run(() => window.voxel.server.install(type, mc), 'Сервер установлен')}
            className="rounded-xl bg-[var(--vx-accent)] px-5 py-2 text-sm font-medium text-black/80 disabled:opacity-40"
          >
            {status?.installed ? 'Переустановить jar' : 'Установить'}
          </button>
          <span className="text-xs text-[var(--vx-muted)]">{status?.installed ? `Установлен: ${status.type} ${status.mc}` : 'Не установлен'}</span>
        </div>
      </Glass>

      <Glass className="grid grid-cols-2 gap-4 p-6">
        <label className="flex flex-col gap-1.5 text-xs text-[var(--vx-muted)]">
          MOTD
          <input value={motd} maxLength={59} onChange={(e) => setMotd(e.target.value)} className="rounded-xl border border-white/[0.08] bg-black/25 px-4 py-2 text-sm text-[var(--vx-text)] outline-none" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-[var(--vx-muted)]">
          Порт
          <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} className="rounded-xl border border-white/[0.08] bg-black/25 px-4 py-2 font-mono text-sm text-[var(--vx-text)] outline-none" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlineMode} onChange={(e) => setOnlineMode(e.target.checked)} className="accent-[var(--vx-accent)]" />
          online-mode (проверка аккаунтов Mojang)
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-[var(--vx-muted)]">
          Автобэкап мира (хранится 5)
          <select value={backup} onChange={(e) => setBackup(e.target.value as ServerStatus['backup'])} className="rounded-xl border border-white/[0.08] bg-black/25 px-4 py-2 text-sm text-[var(--vx-text)] outline-none">
            <option value="off">выключен</option>
            <option value="30m">каждые 30 минут</option>
            <option value="1h">каждый час</option>
            <option value="24h">раз в сутки</option>
          </select>
        </label>
        <div className="col-span-2 flex items-center justify-between">
          <span className="text-[11px] text-[var(--vx-muted)]">RCON и query выключены. Seed существующего мира не меняется.</span>
          <button
            disabled={busy}
            onClick={() => void run(() => window.voxel.server.configure({ motd, port, onlineMode, backup }), 'Настройки сохранены')}
            className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm"
          >
            Сохранить настройки
          </button>
        </div>
      </Glass>

      <Glass className="flex flex-col gap-3 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Публичный адрес (bore.pub)</div>
            <div className="text-[11px] text-[var(--vx-muted)]">Туннель до порта {status?.port}. Адрес выдаёт bore.pub.</div>
          </div>
          {publicAddr ? (
            <button onClick={() => void window.voxel.publish.set(false, port).then(() => setPublicAddr(null))} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm">Закрыть туннель</button>
          ) : (
            <button
              disabled={!status?.running}
              onClick={() => void window.voxel.publish.set(true, port).then((r) => (r.ok && r.data?.address ? setPublicAddr(r.data.address) : setMsg(r.error ?? 'Не удалось открыть туннель')))}
              className="rounded-xl bg-[var(--vx-accent)] px-4 py-2 text-sm font-medium text-black/85 disabled:opacity-40"
            >
              Открыть туннель
            </button>
          )}
        </div>
        {publicAddr && <div className="font-mono text-sm text-[var(--vx-accent)]">{publicAddr}</div>}
      </Glass>

      <Glass className="flex items-center gap-3 p-6">
        {status?.running ? (
          <button onClick={() => void run(() => window.voxel.server.stop().then((ok) => ({ ok })), 'Остановка…')} className="rounded-xl bg-red-500/80 px-5 py-2 text-sm font-medium text-white">Остановить</button>
        ) : (
          <button
            disabled={!status?.installed || busy}
            onClick={() => void run(() => window.voxel.server.start(ramMb, javaPath), 'Сервер запущен')}
            className="rounded-xl bg-[var(--vx-accent)] px-5 py-2 text-sm font-medium text-black/80 disabled:opacity-40"
          >
            Запустить сервер
          </button>
        )}
        <span className="text-sm text-[var(--vx-muted)]">{status?.running ? 'Работает' : 'Остановлен'} · порт {status?.port}</span>
      </Glass>

      <Glass className="flex flex-col gap-3 p-4">
        <div ref={logRef} className="h-72 overflow-y-auto rounded-xl bg-black/35 p-4 font-mono text-[12px] leading-relaxed">
          {lines.map((l, i) => (
            <div key={i} className={LEVEL_COLOR[l.level] ?? ''}>
              <span className="text-[var(--vx-muted)]">[{l.time}]</span> {l.text}
            </div>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (cmd.trim()) void window.voxel.server.command(cmd).then(() => setCmd('')); }} className="flex gap-2">
          <input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="Команда серверу (stdin), например: say привет" className="w-full rounded-xl border border-white/[0.08] bg-black/25 px-4 py-2 font-mono text-sm outline-none" />
          <button type="submit" disabled={!status?.running} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm disabled:opacity-40">Отправить</button>
        </form>
      </Glass>
    </div>
  );
}
