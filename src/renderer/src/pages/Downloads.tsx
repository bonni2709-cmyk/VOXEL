import { motion } from 'framer-motion';
import { Glass } from '../components/Glass';
import { useLauncher } from '../store/launcher';

const STAGE_LABEL: Record<string, string> = {
  manifest: 'Манифест',
  client: 'Клиент',
  libraries: 'Библиотеки',
  natives: 'Нативы',
  assets: 'Ресурсы',
  done: 'Готово',
  error: 'Ошибка',
};

export function Downloads() {
  const { progress, installing, installed, installError, cancelInstall } = useLauncher();
  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--vx-muted)]">Центр загрузок</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Официальные источники Mojang</h1>
        <p className="mt-2 text-sm text-[var(--vx-muted)]">Каждый файл проверяется по SHA-1 и размеру до записи.</p>
      </header>

      <Glass className="p-6">
        {installing || progress ? (
          <>
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg">{progress?.versionId ?? installing}</span>
              <span className="text-sm text-[var(--vx-muted)]">{STAGE_LABEL[progress?.stage ?? 'manifest']}</span>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full bg-[var(--vx-accent)]"
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-[var(--vx-muted)]">
              <span>{progress ? `${progress.done} / ${progress.total}` : '—'} · {percent}%</span>
              {installing && (
                <button onClick={cancelInstall} className="underline underline-offset-4">Отменить</button>
              )}
            </div>
            {installError && <p className="mt-3 text-sm text-red-400">{installError}</p>}
          </>
        ) : (
          <p className="text-sm text-[var(--vx-muted)]">Активных загрузок нет.</p>
        )}
      </Glass>

      <Glass className="p-6">
        <div className="mb-3 text-sm font-medium">Установленные версии · {installed.length}</div>
        {installed.length === 0 ? (
          <p className="text-sm text-[var(--vx-muted)]">Пока ничего не установлено.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {installed.map((id) => (
              <li key={id} className="font-mono text-sm">{id}</li>
            ))}
          </ul>
        )}
      </Glass>
    </div>
  );
}
