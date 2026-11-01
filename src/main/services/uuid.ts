import { createHash } from 'node:crypto';

/**
 * Офлайн-UUID как в Java: UUID.nameUUIDFromBytes("OfflinePlayer:<ник>").
 * Не связан с аккаунтом Microsoft и не даёт токенов.
 */
export function offlineUuid(nick: string): string {
  const bytes = createHash('md5').update(`OfflinePlayer:${nick}`, 'utf8').digest();
  bytes[6] = (bytes[6]! & 0x0f) | 0x30;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
