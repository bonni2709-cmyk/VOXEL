export const BG_MAX_FILE_BYTES = 16 * 1024 * 1024;
export const BG_MAX_SIDE = 2048;

/** Уменьшает картинку до 2048 px по большей стороне и возвращает JPEG data URL. */
export async function downscaleToDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg)$/.test(file.type)) throw new Error('Нужен PNG или JPG');
  if (file.size > BG_MAX_FILE_BYTES) throw new Error('Файл больше 16 МБ');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, BG_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}
