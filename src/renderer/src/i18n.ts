import { useSettings } from './store/settings';
import type { Lang } from '@shared/types';

/** Словарь RU/EN. Ключи, которых нет в EN, падают обратно на RU. */
const DICT: Record<string, { ru: string; en: string }> = {
  overview: { ru: 'Обзор', en: 'Home' },
  versions: { ru: 'Версии игры', en: 'Game versions' },
  mods: { ru: 'Моды', en: 'Mods' },
  modpacks: { ru: 'Модпаки', en: 'Modpacks' },
  java: { ru: 'Java Manager', en: 'Java Manager' },
  worlds: { ru: 'Миры и карта', en: 'Worlds & map' },
  gallery: { ru: 'Галерея', en: 'Gallery' },
  downloads: { ru: 'Загрузки', en: 'Downloads' },
  console: { ru: 'Консоль', en: 'Console' },
  server: { ru: 'Сервер', en: 'Server' },
  skins: { ru: 'Skin Studio', en: 'Skin Studio' },
  profile: { ru: 'Профиль', en: 'Profile' },
  settings: { ru: 'Настройки', en: 'Settings' },
  play: { ru: 'Играть', en: 'Play' },
  install: { ru: 'Установить', en: 'Install' },
  save: { ru: 'Сохранить', en: 'Save' },
  language: { ru: 'Язык интерфейса', en: 'Interface language' },
};

export function translate(lang: Lang, key: string): string {
  const entry = DICT[key];
  if (!entry) return key;
  return lang === 'en' ? entry.en : entry.ru;
}

export function useT(): (key: string) => string {
  const lang = useSettings((s) => s.lang);
  return (key: string) => translate(lang, key);
}
