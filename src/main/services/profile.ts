import { app } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { NICK_RE, type IpcResult, type OfflineProfile } from '../../shared/types';
import { offlineUuid } from './uuid';

const DEFAULT_NAME = 'VoxelPlayer';

function profilePath(): string {
  return join(app.getPath('userData'), 'profile.json');
}

function toProfile(name: string): OfflineProfile {
  return { type: 'offline', name, uuid: offlineUuid(name) };
}

export async function getProfile(): Promise<OfflineProfile> {
  try {
    const raw = JSON.parse(await fs.readFile(profilePath(), 'utf8')) as { name?: unknown };
    if (typeof raw.name === 'string' && NICK_RE.test(raw.name)) return toProfile(raw.name);
  } catch {
    // файла нет или он повреждён — используем значение по умолчанию
  }
  return toProfile(DEFAULT_NAME);
}

export async function setProfileName(name: string): Promise<IpcResult<OfflineProfile>> {
  const nick = name.trim();
  if (!NICK_RE.test(nick)) {
    return { ok: false, error: 'Ник: 3–16 символов, латиница, цифры и «_».' };
  }
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(profilePath(), JSON.stringify({ name: nick }, null, 2), 'utf8');
  return { ok: true, data: toProfile(nick) };
}
