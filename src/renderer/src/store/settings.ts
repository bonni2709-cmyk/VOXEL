import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { JvmPreset, Lang, PageId, ThemeId } from '@shared/types';

export interface SettingsState {
  page: PageId;
  theme: ThemeId;
  /** Акцент в HEX; null — акцент темы по умолчанию. */
  accent: string | null;
  lang: Lang;
  /** Фон интерфейса (data URL, уже уменьшен до 2048 px); null — без картинки. */
  background: string | null;
  ramMb: number;
  javaPath: string;
  selectedVersion: string | null;
  windowWidth: number;
  windowHeight: number;
  /** Azure Client ID для входа Microsoft. Пусто — вход недоступен. */
  msClientId: string;
  jvmPreset: JvmPreset;
  customFlags: string;
  proxy: string;
  mirror: string;
  setJvmPreset: (p: JvmPreset) => void;
  setCustomFlags: (f: string) => void;
  setNetwork: (proxy: string, mirror: string) => void;
  setPage: (page: PageId) => void;
  setTheme: (theme: ThemeId) => void;
  setAccent: (accent: string | null) => void;
  setLang: (lang: Lang) => void;
  setBackground: (background: string | null) => void;
  setRam: (mb: number) => void;
  setJavaPath: (path: string) => void;
  setSelectedVersion: (id: string | null) => void;
  setWindow: (width: number, height: number) => void;
  setMsClientId: (id: string) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      page: 'overview',
      theme: 'sapphire',
      accent: null,
      lang: 'ru',
      background: null,
      ramMb: 2048,
      javaPath: 'auto',
      selectedVersion: null,
      windowWidth: 1280,
      windowHeight: 720,
      msClientId: '',
      jvmPreset: 'aikar',
      customFlags: '',
      proxy: '',
      mirror: '',
      setJvmPreset: (jvmPreset) => set({ jvmPreset }),
      setCustomFlags: (customFlags) => set({ customFlags }),
      setNetwork: (proxy, mirror) => set({ proxy: proxy.trim(), mirror: mirror.trim() }),
      setPage: (page) => set({ page }),
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setLang: (lang) => set({ lang }),
      setBackground: (background) => set({ background }),
      setRam: (ramMb) => set({ ramMb }),
      setJavaPath: (javaPath) => set({ javaPath }),
      setSelectedVersion: (selectedVersion) => set({ selectedVersion }),
      setWindow: (windowWidth, windowHeight) => set({ windowWidth, windowHeight }),
      setMsClientId: (msClientId) => set({ msClientId: msClientId.trim() }),
    }),
    { name: 'voxel-settings' },
  ),
);
