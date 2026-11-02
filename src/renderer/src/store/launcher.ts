import { useSettings } from './settings';
import { create } from 'zustand';
import type { InstallProgress, LaunchExit, LogLine, VersionSummary } from '@shared/types';

const MAX_LOGS = 2000;

export interface LauncherState {
  versions: VersionSummary[];
  versionsLoading: boolean;
  versionsError: string | null;
  installed: string[];
  installing: string | null;
  progress: InstallProgress | null;
  installError: string | null;
  logs: LogLine[];
  running: boolean;
  lastExit: LaunchExit | null;
  loadVersions: () => Promise<void>;
  refreshInstalled: () => Promise<void>;
  install: (id: string) => Promise<void>;
  cancelInstall: () => void;
  play: (versionId: string, ramMb: number, javaPath: string) => Promise<void>;
  stop: () => Promise<void>;
  pushLog: (line: LogLine) => void;
  clearLogs: () => void;
}

export const useLauncher = create<LauncherState>()((set, get) => ({
  versions: [],
  versionsLoading: false,
  versionsError: null,
  installed: [],
  installing: null,
  progress: null,
  installError: null,
  logs: [],
  running: false,
  lastExit: null,

  loadVersions: async () => {
    set({ versionsLoading: true, versionsError: null });
    const res = await window.voxel.versions.list();
    if (res.ok && res.data) set({ versions: res.data, versionsLoading: false });
    else set({ versionsError: res.error ?? 'Не удалось получить список версий.', versionsLoading: false });
  },

  refreshInstalled: async () => {
    set({ installed: await window.voxel.versions.installed() });
  },

  install: async (id) => {
    set({ installing: id, installError: null, progress: null });
    const res = await window.voxel.install.start(id);
    set({ installing: null, installError: res.ok ? null : (res.error ?? 'Ошибка установки') });
    await get().refreshInstalled();
  },

  cancelInstall: () => {
    const id = get().installing;
    if (id) void window.voxel.install.cancel(id);
  },

  play: async (versionId, ramMb, javaPath) => {
    const tuning = useSettings.getState();
    const res = await window.voxel.launch.start({
      versionId, ramMb, width: 1280, height: 720, javaPath,
      jvmPreset: tuning.jvmPreset, customFlags: tuning.customFlags,
    });
    if (!res.ok) {
      get().pushLog({ level: 'error', text: res.error ?? 'Не удалось запустить игру', time: new Date().toLocaleTimeString('ru-RU') });
      return;
    }
    set({ running: true, lastExit: null });
  },

  stop: async () => {
    await window.voxel.launch.stop();
  },

  pushLog: (line) =>
    set((s) => ({ logs: [...s.logs, line].slice(-MAX_LOGS) })),

  clearLogs: () => set({ logs: [] }),
}));

/** Подписка на события main-процесса; вызывается один раз при старте. */
export function subscribeLauncherEvents(): () => void {
  const store = useLauncher;
  const offProgress = window.voxel.on.installProgress((p) => {
    store.setState({ progress: p, ...(p.stage === 'error' ? { installError: p.error ?? null } : {}) });
  });
  const offLog = window.voxel.on.launchLog((line) => store.getState().pushLog(line));
  const offExit = window.voxel.on.launchExit((exit) => store.setState({ running: false, lastExit: exit }));
  return () => {
    offProgress();
    offLog();
    offExit();
  };
}
