import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PageId, ThemeId } from '@shared/types';

export interface SettingsState {
  page: PageId;
  theme: ThemeId;
  /** Акцент в HEX; null — акцент темы по умолчанию. */
  accent: string | null;
  ramMb: number;
  windowWidth: number;
  windowHeight: number;
  setPage: (page: PageId) => void;
  setTheme: (theme: ThemeId) => void;
  setAccent: (accent: string | null) => void;
  setRam: (mb: number) => void;
  setWindow: (width: number, height: number) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      page: 'overview',
      theme: 'sapphire',
      accent: null,
      ramMb: 2048,
      windowWidth: 1280,
      windowHeight: 720,
      setPage: (page) => set({ page }),
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setRam: (ramMb) => set({ ramMb }),
      setWindow: (windowWidth, windowHeight) => set({ windowWidth, windowHeight }),
    }),
    { name: 'voxel-settings' },
  ),
);
