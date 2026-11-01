/** Проверка PNG-скинов: сигнатура, IHDR, размеры 64x64 или 64x32, размер файла ≤ 128 KB. */

export const SKIN_MAX_BYTES = 128 * 1024;
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface SkinCheck {
  ok: boolean;
  width?: number;
  height?: number;
  error?: string;
}

export function checkSkinPng(buf: Buffer): SkinCheck {
  if (buf.length > SKIN_MAX_BYTES) return { ok: false, error: 'Файл больше 128 КБ' };
  if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIG)) return { ok: false, error: 'Это не PNG' };
  if (buf.subarray(12, 16).toString('latin1') !== 'IHDR') return { ok: false, error: 'Повреждён заголовок PNG' };
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  if (!((width === 64 && height === 64) || (width === 64 && height === 32))) {
    return { ok: false, error: `Размер ${width}×${height}: нужен 64×64 или 64×32` };
  }
  if (bitDepth !== 8) return { ok: false, error: 'Нужна глубина цвета 8 бит' };
  if (colorType !== 6 && colorType !== 2) return { ok: false, error: 'Нужен PNG с альфа-каналом (RGBA)' };
  return { ok: true, width, height };
}

/** Безопасное имя скина: латиница, цифры, `_`, `-`, до 32 символов. */
export function skinFileName(name: string): string | null {
  return /^[A-Za-z0-9_-]{1,32}$/.test(name) ? `${name}.png` : null;
}
