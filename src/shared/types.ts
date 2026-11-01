export type Lang = 'ru' | 'en';

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
  | 'skins'
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

export interface VersionSummary {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  releaseTime: string;
}

export type InstallStage = 'manifest' | 'client' | 'libraries' | 'natives' | 'assets' | 'done' | 'error';

export interface InstallProgress {
  versionId: string;
  stage: InstallStage;
  done: number;
  total: number;
  error?: string;
}

export interface LaunchOptions {
  versionId: string;
  ramMb: number;
  width: number;
  height: number;
  javaPath: string;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'java';

export interface LogLine {
  level: LogLevel;
  text: string;
  time: string;
}

export interface LaunchExit {
  code: number | null;
  signal: string | null;
  findings?: CrashFinding[];
}

export interface WorldInfo {
  name: string;
  sizeBytes: number;
  lastPlayed: number;
}

export interface GalleryItem {
  name: string;
  dataUrl: string;
}

export interface ModHit {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  downloads: number;
  iconUrl: string | null;
}

export interface CrashFinding {
  title: string;
  hint: string;
  line: string;
}

/** Аккаунт для показа в UI (без токенов). */
export interface AccountView {
  kind: 'offline' | 'microsoft';
  name: string;
  uuid: string;
}

export interface ServerStatus {
  installed: boolean;
  running: boolean;
  type: 'vanilla' | 'paper' | 'fabric' | null;
  mc: string | null;
  port: number;
  motd: string;
  onlineMode: boolean;
  backup: '30m' | '1h' | '24h' | 'off';
}

export interface ScriptToggle {
  dir: string;
  enabled: boolean;
  present: boolean;
}

export interface DependencyFinding {
  kind: 'missing' | 'version' | 'conflict' | 'minecraft' | 'unknown-range';
  mod: string;
  message: string;
}

export interface SkinEntry {
  name: string;
  dataUrl: string;
}
