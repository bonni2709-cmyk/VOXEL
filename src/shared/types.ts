export type ThemeId = 'emerald' | 'sapphire' | 'ruby' | 'amethyst' | 'light';

export const THEME_IDS: ThemeId[] = ['emerald', 'sapphire', 'ruby', 'amethyst', 'light'];

export type PageId =
  | 'overview'
  | 'versions'
  | 'mods'
  | 'modpacks'
  | 'java'
  | 'worlds'
  | 'gallery'
  | 'downloads'
  | 'console'
  | 'server'
  | 'profile'
  | 'settings';

export interface AppInfo {
  name: string;
  version: string;
  platform: NodeJS.Platform;
}

export interface SystemInfo {
  totalMemoryMb: number;
}

export interface OfflineProfile {
  type: 'offline';
  name: string;
  uuid: string;
}

/** Ник офлайн-профиля: латиница, цифры и `_`, 3–16 символов. */
export const NICK_RE = /^[A-Za-z0-9_]{3,16}$/;

export const ACCENT_RE = /^#[0-9a-fA-F]{6}$/;

export interface IpcResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
