import type { PageId } from '@shared/types';

const TITLES: Partial<Record<PageId, string>> = {

  mods: 'Моды',
  modpacks: 'Модпаки',
  java: 'Java Manager',
  worlds: 'Миры и карта',
  gallery: 'Галерея',


  server: 'Сервер',
};

export function Placeholder({ page }: { page: PageId }) {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{TITLES[page] ?? page}</h1>
        <p className="mt-2 text-sm text-[var(--vx-muted)]">Раздел в разработке.</p>
      </div>
    </div>
  );
}
