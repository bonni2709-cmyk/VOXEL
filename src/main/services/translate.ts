/**
 * Перевод описаний модов через MyMemory (бесплатный API, без ключа, лимит ~5000 символов/день).
 * Запрос идёт из main-процесса: renderer не ходит на чужие домены напрямую.
 */

export const MAX_TRANSLATE_CHARS = 500;

/** Достаёт перевод из ответа MyMemory; null — если API вернул ошибку или пусто. */
export function parseMyMemory(json: unknown): string | null {
  const j = json as { responseStatus?: number | string; responseData?: { translatedText?: unknown } } | null;
  if (!j || String(j.responseStatus) !== '200') return null;
  const text = j.responseData?.translatedText;
  return typeof text === 'string' && text.trim() ? text : null;
}

export async function translateText(text: string, from = 'en', to = 'ru'): Promise<string> {
  const clean = text.trim().slice(0, MAX_TRANSLATE_CHARS);
  if (!clean) throw new Error('Описание пустое');
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', clean);
  url.searchParams.set('langpair', `${from}|${to}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Сервис перевода недоступен (HTTP ${res.status})`);
  const out = parseMyMemory(await res.json());
  if (!out) throw new Error('Не удалось перевести описание');
  return out;
}
