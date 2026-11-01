import { isAllowed, type RuleContext, type Rule } from './rules';

export interface RawArgEntry {
  rules?: Rule[];
  value: string | string[];
}

export interface VersionArguments {
  game?: (string | RawArgEntry)[];
  jvm?: (string | RawArgEntry)[];
}

/** Подстановка ${placeholder}. Неизвестный плейсхолдер — ошибка, запуск блокируется. */
export function substitute(template: string, values: Record<string, string>): string {
  return template.replace(/\$\{([a-z_]+)\}/gi, (_, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`Не задан аргумент запуска: ${key}`);
    return value;
  });
}

function expandEntries(
  entries: (string | RawArgEntry)[] | undefined,
  ctx: RuleContext,
  values: Record<string, string>,
): string[] {
  const out: string[] = [];
  for (const entry of entries ?? []) {
    if (typeof entry === 'string') {
      out.push(substitute(entry, values));
      continue;
    }
    if (!isAllowed(entry.rules, ctx)) continue;
    const list = Array.isArray(entry.value) ? entry.value : [entry.value];
    for (const v of list) out.push(substitute(v, values));
  }
  return out;
}

/**
 * Собирает JVM- и game-аргументы. Поддерживает формат 1.13+ (arguments)
 * и legacy (minecraftArguments).
 */
export function buildArguments(
  args: VersionArguments | undefined,
  legacyGameArgs: string | undefined,
  ctx: RuleContext,
  values: Record<string, string>,
): { jvm: string[]; game: string[] } {
  if (args) {
    return {
      jvm: expandEntries(args.jvm, ctx, values),
      game: expandEntries(args.game, ctx, values),
    };
  }
  const game = (legacyGameArgs ?? '').split(' ').filter(Boolean).map((s) => substitute(s, values));
  return { jvm: [], game };
}
