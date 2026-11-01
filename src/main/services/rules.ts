/** Правила библиотек/аргументов Mojang: OS, arch, feature flags. */

export type OsName = 'windows' | 'osx' | 'linux';

export interface RuleContext {
  osName: OsName;
  arch: string;
  features: Record<string, boolean>;
}

export interface Rule {
  action: 'allow' | 'disallow';
  os?: { name?: OsName; arch?: string; version?: string };
  features?: Record<string, boolean>;
}

export function currentOs(platform: NodeJS.Platform): OsName {
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'osx';
  return 'linux';
}

export function ruleMatches(rule: Rule, ctx: RuleContext): boolean {
  if (rule.os) {
    if (rule.os.name && rule.os.name !== ctx.osName) return false;
    if (rule.os.arch && rule.os.arch !== ctx.arch) return false;
  }
  if (rule.features) {
    for (const [key, expected] of Object.entries(rule.features)) {
      if ((ctx.features[key] ?? false) !== expected) return false;
    }
  }
  return true;
}

/**
 * Без правил — разрешено. С правилами по умолчанию запрещено,
 * побеждает последнее совпавшее правило (как в официальном лаунчере).
 */
export function isAllowed(rules: Rule[] | undefined, ctx: RuleContext): boolean {
  if (!rules || rules.length === 0) return true;
  let allowed = false;
  for (const rule of rules) {
    if (ruleMatches(rule, ctx)) allowed = rule.action === 'allow';
  }
  return allowed;
}
