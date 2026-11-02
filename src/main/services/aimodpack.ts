/**
 * AI Modpack Builder: LLM (Groq или Mistral, OpenAI-совместимый API) предлагает моды,
 * каждый проверяется поиском в Modrinth; в результат попадают только найденные проекты.
 */
import { searchMods } from './modrinth';
import type { ModHit } from '../../shared/types';

export type LlmProvider = 'groq' | 'mistral';

const ENDPOINTS: Record<LlmProvider, { url: string; model: string }> = {
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  mistral: { url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest' },
};

export interface ModSuggestion {
  query: string;
  reason: string;
}

export function buildMessages(userText: string, gameVersion: string) {
  const system = [
    'You recommend Minecraft Fabric mods for a modpack.',
    `Target Minecraft version: ${gameVersion}. Loader: Fabric.`,
    'Reply ONLY with JSON: {"mods":[{"query":"<modrinth search query, mod name in English>","reason":"<short reason in Russian>"}]}.',
    'Return 5 to 12 mods. Do not include Fabric API unless needed. No text outside JSON.',
  ].join(' ');
  return [
    { role: 'system', content: system },
    { role: 'user', content: userText.slice(0, 500) },
  ];
}

/** Достаёт список предложений из ответа модели; мусор и лишний текст отбрасываются. */
export function parseSuggestions(content: string): ModSuggestion[] {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.slice(start, end + 1));
  } catch {
    return [];
  }
  const mods = (parsed as { mods?: unknown }).mods;
  if (!Array.isArray(mods)) return [];
  const out: ModSuggestion[] = [];
  for (const m of mods) {
    const q = (m as { query?: unknown }).query;
    const r = (m as { reason?: unknown }).reason;
    if (typeof q !== 'string' || q.trim().length < 2 || q.length > 80) continue;
    out.push({ query: q.trim(), reason: typeof r === 'string' ? r.slice(0, 200) : '' });
    if (out.length >= 12) break;
  }
  return out;
}

export async function askLlm(provider: LlmProvider, apiKey: string, userText: string, gameVersion: string): Promise<string> {
  const ep = ENDPOINTS[provider];
  const res = await fetch(ep.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: ep.model, messages: buildMessages(userText, gameVersion), temperature: 0.4, max_tokens: 800 }),
    signal: AbortSignal.timeout(45_000),
  });
  if (res.status === 401 || res.status === 403) throw new Error('Ключ API отклонён провайдером');
  if (!res.ok) throw new Error(`Ошибка LLM: HTTP ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Пустой ответ модели');
  return content;
}

/** Полный цикл: запрос → разбор → проверка каждого мода через Modrinth. */
export async function buildModpack(
  provider: LlmProvider,
  apiKey: string,
  userText: string,
  gameVersion: string,
): Promise<{ hit: ModHit; reason: string }[]> {
  const suggestions = parseSuggestions(await askLlm(provider, apiKey, userText, gameVersion));
  if (suggestions.length === 0) throw new Error('Модель не предложила моды. Уточните запрос.');
  const out: { hit: ModHit; reason: string }[] = [];
  const seen = new Set<string>();
  for (const s of suggestions) {
    const hits = await searchMods(s.query, gameVersion).catch(() => []);
    const hit = hits[0];
    if (!hit || seen.has(hit.projectId)) continue;
    seen.add(hit.projectId);
    out.push({ hit, reason: s.reason });
  }
  return out;
}
