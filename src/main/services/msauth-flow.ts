import { BrowserWindow, safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import {
  buildAuthorizeUrl, dashUuid, minecraftLoginBody, MS_REDIRECT, parseAuthRedirect,
  tokenRequestBody, xboxAuthBody, xstsAuthBody, xstsError, type MsProfileRaw,
} from './msauth';

export interface MsSession {
  type: 'microsoft';
  name: string;
  uuid: string;
  accessToken: string;
  /** Срок действия токена Minecraft, мс с эпохи. */
  expiresAt: number;
}

async function postJson<T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* не JSON */ }
  if (!res.ok) {
    const xerr = (json as { XErr?: number } | null)?.XErr;
    if (xerr !== undefined) throw new Error(xstsError(xerr));
    throw new Error(`Ошибка сервера ${new URL(url).hostname}: HTTP ${res.status}`);
  }
  return json as T;
}

/** Окно входа Microsoft: ловит редирект с кодом и закрывается. */
function askMicrosoft(clientId: string, parent: BrowserWindow | null): Promise<string> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 480, height: 640, parent: parent ?? undefined, modal: Boolean(parent),
      autoHideMenuBar: true, title: 'Вход в Microsoft',
      webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
    });
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
      if (!win.isDestroyed()) win.close();
    };
    const onUrl = (url: string) => {
      if (!url.startsWith(MS_REDIRECT)) return;
      const r = parseAuthRedirect(url);
      finish(() => ('code' in r ? resolve(r.code) : reject(new Error(r.error))));
    };
    win.webContents.on('will-redirect', (_e, url) => onUrl(url));
    win.webContents.on('did-navigate', (_e, url) => onUrl(url));
    win.on('closed', () => finish(() => reject(new Error('Вход отменён'))));
    void win.loadURL(buildAuthorizeUrl(clientId));
  });
}

/** Полная цепочка: код → токен MS → Xbox → XSTS → Minecraft → профиль (проверка владения игрой). */
export async function signInMicrosoft(clientId: string, parent: BrowserWindow | null): Promise<MsSession> {
  if (!clientId) throw new Error('Укажите Azure Client ID в Настройках');
  const code = await askMicrosoft(clientId, parent);

  const tokenRes = await fetch('https://login.live.com/oauth20_token.srf', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: tokenRequestBody(clientId, code),
    signal: AbortSignal.timeout(30_000),
  });
  const tok = (await tokenRes.json()) as { access_token?: string; error_description?: string };
  if (!tok.access_token) throw new Error(tok.error_description ?? 'Не удалось получить токен Microsoft');

  const xbl = await postJson<{ Token: string }>('https://user.auth.xboxlive.com/user/authenticate', xboxAuthBody(tok.access_token),
    { 'x-xbl-contract-version': '1' });
  const xsts = await postJson<{ Token: string; DisplayClaims: { xui: { uhs: string }[] } }>(
    'https://xsts.auth.xboxlive.com/xsts/authorize', xstsAuthBody(xbl.Token), { 'x-xbl-contract-version': '1' });
  const uhs = xsts.DisplayClaims.xui[0]?.uhs;
  if (!uhs) throw new Error('Xbox не вернул идентификатор пользователя');

  const mc = await postJson<{ access_token: string; expires_in: number }>(
    'https://api.minecraftservices.com/authentication/login_with_xbox', minecraftLoginBody(uhs, xsts.Token));

  const ent = await fetch('https://api.minecraftservices.com/entitlements/mcstore', {
    headers: { authorization: `Bearer ${mc.access_token}` }, signal: AbortSignal.timeout(30_000),
  });
  const entJson = (await ent.json()) as { items?: unknown[] };
  if (!entJson.items || entJson.items.length === 0) throw new Error('На аккаунте нет лицензии Minecraft Java Edition');

  const prof = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { authorization: `Bearer ${mc.access_token}` }, signal: AbortSignal.timeout(30_000),
  });
  if (!prof.ok) throw new Error('У аккаунта нет профиля Minecraft — создайте ник в лаунчере Minecraft');
  const raw = (await prof.json()) as MsProfileRaw;

  return {
    type: 'microsoft',
    name: raw.name,
    uuid: dashUuid(raw.id),
    accessToken: mc.access_token,
    expiresAt: Date.now() + mc.expires_in * 1000,
  };
}

/** Сессия хранится зашифрованной через OS keychain (safeStorage). */
function sessionPath(root: string): string {
  return join(root, 'auth.bin');
}

export async function saveSession(root: string, s: MsSession): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Шифрование недоступно: токен не сохранён');
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(sessionPath(root), safeStorage.encryptString(JSON.stringify(s)));
}

export async function loadSession(root: string): Promise<MsSession | null> {
  try {
    const raw = safeStorage.decryptString(await fs.readFile(sessionPath(root)));
    const s = JSON.parse(raw) as MsSession;
    return s.type === 'microsoft' && s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export async function clearSession(root: string): Promise<void> {
  await fs.unlink(sessionPath(root)).catch(() => undefined);
}
