import { describe, expect, it } from 'vitest';
import { offlineUuid } from '../uuid';

describe('offlineUuid', () => {
  // Известное значение офлайн-UUID для ника "Notch" из официальной реализации Java.
  it('совпадает с Java UUID.nameUUIDFromBytes("OfflinePlayer:Notch")', () => {
    expect(offlineUuid('Notch')).toBe('b50ad385-829d-3141-a216-7e7d7539ba7f');
  });
  it('версия 3 и вариант RFC 4122', () => {
    const u = offlineUuid('VoxelPlayer');
    expect(u[14]).toBe('3');
    expect(['8', '9', 'a', 'b']).toContain(u[19]);
  });
});
