/**
 * Network Shield: маршрутизация загрузок.
 * Порядок: прямое соединение → прокси пользователя → зеркало.
 * Microsoft, Xbox и VirusTotal никогда не идут через запасные маршруты.
 * Таймаут ожидания заголовков ответа — 15 с.
 */
import { fetch as undiciFetch, ProxyAgent } from 'undici';

export const HEADER_TIMEOUT_MS = 15_000;

const NO_FALLBACK_SUFFIXES = ['microsoft.com', 'live.com', 'xboxlive.com', 'minecraftservices.com', 'virustotal.com'];

export function isNoFallbackHost(host: string): boolean {
  const h = host.toLowerCase();
  return NO_FALLBACK_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

export type Route = 'direct' | 'proxy' | 'mirror';

export interface ShieldConfig {
  /** Прокси пользователя, например http://127.0.0.1:8080 */
  proxy?: string;
  /** Зеркало: базовый адрес, которым заменяется origin (например https://mirror.example.com). */
  mirror?: string;
}

/** План маршрутов для URL. Для защищённых хостов — только прямой маршрут. */
export function planRoutes(url: string, cfg: ShieldConfig): Route[] {
  const host = new URL(url).hostname;
  if (isNoFallbackHost(host)) return ['direct'];
  const routes: Route[] = ['direct'];
  if (cfg.proxy) routes.push('proxy');
  if (cfg.mirror) routes.push('mirror');
  return routes;
}

export function mirrorUrl(url: string, mirror: string): string {
  const u = new URL(url);
  const base = new URL(mirror);
  return `${base.origin}${base.pathname.replace(/\/$/, '')}${u.pathname}${u.search}`;
}

export type Transport = (url: string, signal: AbortSignal) => Promise<Response>;

export function directTransport(url: string, signal: AbortSignal): Promise<Response> {
  return fetch(url, { signal });
}

export function proxyTransport(proxy: string): Transport {
  const dispatcher = new ProxyAgent(proxy);
  return async (url, signal) =>
    (await undiciFetch(url, { dispatcher, signal })) as unknown as Response;
}

/** Выполняет запрос по маршрутам; таймаут каждого — до заголовков ответа. */
export async function shieldFetch(
  url: string,
  cfg: ShieldConfig,
  transports: Partial<Record<Route, Transport>> = {},
  headerTimeoutMs = HEADER_TIMEOUT_MS,
): Promise<{ response: Response; route: Route }> {
  const routes = planRoutes(url, cfg);
  const errors: string[] = [];
  for (const route of routes) {
    const target = route === 'mirror' ? mirrorUrl(url, cfg.mirror!) : url;
    const transport = transports[route] ?? (route === 'proxy' ? proxyTransport(cfg.proxy!) : directTransport);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), headerTimeoutMs);
    try {
      const response = await transport(target, ctl.signal);
      clearTimeout(timer);
      return { response, route };
    } catch (err) {
      clearTimeout(timer);
      errors.push(`${route}: ${(err as Error).name === 'AbortError' ? 'таймаут 15 с' : (err as Error).message}`);
    }
  }
  throw new Error(`Не удалось подключиться (${errors.join('; ')})`);
}
