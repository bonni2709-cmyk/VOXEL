import { app, BrowserWindow, ipcMain } from 'electron';
import { totalmem } from 'node:os';
import { join } from 'node:path';
import { IPC } from '../shared/ipc';
import type { AppInfo, IpcResult, OfflineProfile, SystemInfo } from '../shared/types';
import { getProfile, setProfileName } from './services/profile';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0F1115',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.appInfo, (): AppInfo => ({
    name: 'VOXEL',
    version: app.getVersion(),
    platform: process.platform,
  }));

  ipcMain.handle(IPC.systemInfo, (): SystemInfo => ({
    totalMemoryMb: Math.floor(totalmem() / 1024 / 1024),
  }));

  ipcMain.handle(IPC.profileGet, (): Promise<OfflineProfile> => getProfile());

  ipcMain.handle(
    IPC.profileSetName,
    (_event, name: unknown): Promise<IpcResult<OfflineProfile>> => {
      if (typeof name !== 'string') return Promise.resolve({ ok: false, error: 'Некорректное имя.' });
      return setProfileName(name);
    },
  );
}

void app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
