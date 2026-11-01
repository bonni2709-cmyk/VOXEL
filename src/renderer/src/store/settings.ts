import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PageId, ThemeId } from '@shared/types';

export interface SettingsState {
  page: PageId;
  theme: ThemeId;
  /** Акцент в HEX; null — акцент темы по умолчанию. */
  accent: string | null;
  ramMb: number;
  javaPath: string;
  selectedVersion: string | null;
  windowWidth: number;
  windowHeight: number;
  setPage: (page: PageId) => void;
  setTheme: (theme: ThemeId) => void;
  setAccent: (accent: string | null) => void;
  setRam: (mb: number) => void;
  setJavaPath: (path: string) => void;
  setSelectedVersion: (id: string | null) => void;
  setWindow: (width: number, height: number) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      page: 'overview',
      theme: 'sapphire',
      accent: null,
      ramMb: 2048,
      javaPath: 'java',
      selectedVersion: null,
      windowWidth: 1280,
      windowHeight: 720,
      setPage: (page) => set({ page }),
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setRam: (ramMb) => set({ ramMb }),
      setJavaPath: (javaPath) => set({ javaPath }),
      setSelectedVersion: (selectedVersion) => set({ selectedVersion }),
      setWindow: (windowWidth, windowHeight) => set({ windowWidth, windowHeight }),
    }),
    { name: 'voxel-settings' },
  ),
);
