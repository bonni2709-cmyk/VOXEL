/**
 * Вход через Microsoft: OAuth (login.live.com) → Xbox Live → XSTS → Minecraft services → профиль.
 * Здесь собраны чистые части цепочки (URL, тела запросов, разбор ответов); сетевой вызов — в signIn().
 * Нужен Azure client ID приложения (задаётся в Настройках).
 */

export const MS_REDIRECT = 'https://login.live.com/oauth20_desktop.srf';
export const MS_SCOPE = 'XboxLive.signin offline_access';

export function buildAuthorizeUrl(clientId: string): string {
  const u = new URL('https://login.live.com/oauth20_authorize.srf');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', MS_REDIRECT);
  u.searchParams.set('scope', MS_SCOPE);
  u.searchParams.set('prompt', 'select_account');
  return u.toString();
}

/** Достаёт код из адреса редиректа; при отказе пользователя — понятная ошибка. */
export function parseAuthRedirect(url: string): { code: string } | { error: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { error: 'Некорректный адрес ответа' };
  }
  if (!url.startsWith(MS_REDIRECT)) return { error: 'Неожиданный адрес ответа' };
  const err = u.searchParams.get('error_description') ?? u.searchParams.get('error');
  if (err) return { error: `Microsoft отклонил вход: ${err}` };
  const code = u.searchParams.get('code');
  return code ? { code } : { error: 'В ответе нет кода авторизации' };
}

export function tokenRequestBody(clientId: string, code: string): URLSearchParams {
  return new URLSearchParams({
    client_id: clientId,
    code,
    grant_type: 'authorization_code',
    redirect_uri: MS_REDIRECT,
    scope: MS_SCOPE,
  });
}

export function xboxAuthBody(accessToken: string) {
  return {
    Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${accessToken}` },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT',
  };
}

export function xstsAuthBody(xblToken: string) {
  return {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT',
  };
}

/** Коды ошибок XSTS → понятные сообщения. */
const XERR: Record<number, string> = {
  2148916233: 'У аккаунта Microsoft нет Xbox-профиля. Создайте его на xbox.com.',
  2148916235: 'Xbox Live недоступен в вашей стране.',
  2148916236: 'Нужно подтвердить возраст в аккаунте Xbox.',
  2148916237: 'Нужно подтвердить возраст в аккаунте Xbox.',
  2148916238: 'Аккаунт ребёнка: добавьте его в семью Microsoft.',
};

export function xstsError(xerr: number | undefined): string {
  return (xerr && XERR[xerr]) || 'Ошибка авторизации Xbox';
}

export function minecraftLoginBody(uhs: string, xstsToken: string): { identityToken: string } {
  return { identityToken: `XBL3.0 x=${uhs};${xstsToken}` };
}

/** UUID из 32 hex-символов Mojang → с дефисами. */
export function dashUuid(id: string): string {
  const h = id.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(h)) throw new Error('Некорректный UUID профиля');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export interface MsProfileRaw {
  id: string;
  name: string;
}
