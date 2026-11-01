import { app } from 'electron';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { NICK_RE, type IpcResult, type OfflineProfile } from '../../shared/types';

const DEFAULT_NAME = 'VoxelPlayer';

/**
 * Офлайн-UUID как в Java: UUID.nameUUIDFromBytes("OfflinePlayer:<nick>").
 * Не связан с аккаунтом Microsoft и не даёт токенов.
 */
export function offlineUuid(nick: string): string {
  const bytes = createHash('md5').update(`OfflinePlayer:${nick}`, 'utf8').digest();
  bytes[6] = (bytes[6]! & 0x0f) | 0x30;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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
