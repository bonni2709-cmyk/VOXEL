/**
 * Разбор версий Minecraft и semver-подобных диапазонов:
 *   "1.21.3", "26.3-rc.1", "1.19-alpha.22.11.a", "~26.3-", ">=1.16-rc.3", ">1.19", "^1.20", "1.20 <1.21"
 * Неизвестный формат не бросает ошибку: satisfies() вернёт null («проверьте вручную»).
 */

export interface McVersion {
  nums: number[];
  /** Идентификаторы pre-release (alpha/beta/pre/rc/...); null для релиза. */
  pre: string[] | null;
}

const STAGE_RANK: Record<string, number> = { alpha: 0, a: 0, beta: 1, b: 1, pre: 2, rc: 3 };

export function parseMcVersion(input: string): McVersion | null {
  const m = /^(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.]+))?$/.exec(input.trim());
  if (!m) return null;
  return {
    nums: m[1].split('.').map(Number),
    pre: m[2] ? m[2].split('.') : null,
  };
}

function cmpIdent(a: string, b: string): number {
  const na = /^\d+$/.test(a);
  const nb = /^\d+$/.test(b);
  if (na && nb) return Math.sign(Number(a) - Number(b));
  if (na !== nb) return na ? -1 : 1;
  const ra = STAGE_RANK[a.toLowerCase()];
  const rb = STAGE_RANK[b.toLowerCase()];
  if (ra !== undefined && rb !== undefined && ra !== rb) return ra - rb;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareMc(a: McVersion, b: McVersion): number {
  const len = Math.max(a.nums.length, b.nums.length);
  for (let i = 0; i < len; i++) {
    const d = (a.nums[i] ?? 0) - (b.nums[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  // релиз старше/новее любого pre-release того же базового номера: 1.16 > 1.16-rc.3
  if (a.pre === null && b.pre === null) return 0;
  if (a.pre === null) return 1;
  if (b.pre === null) return -1;
  const plen = Math.max(a.pre.length, b.pre.length);
  for (let i = 0; i < plen; i++) {
    if (a.pre[i] === undefined) return -1;
    if (b.pre[i] === undefined) return 1;
    const c = cmpIdent(a.pre[i], b.pre[i]);
    if (c !== 0) return c;
  }
  return 0;
}

/** Проверяет версию против одного условия (без пробелов). null — формат не распознан. */
function satisfiesOne(version: McVersion, cond: string): boolean | null {
  let m = /^(>=|<=|>|<|=)?\s*(.+)$/.exec(cond);
  if (cond.startsWith('~') || cond.startsWith('^')) {
    const op = cond[0];
    const base = parseMcVersion(cond.slice(1).replace(/-$/, ''));
    if (!base) return null;
    const lower = compareMc(version, base) >= 0;
    if (op === '~') {
      // ~X.Y[.Z]- : та же минорная ветка, не ниже указанной
      const upper: McVersion = { nums: [base.nums[0], (base.nums[1] ?? 0) + 1], pre: null };
      return lower && compareMc(version, upper) < 0;
    }
    // ^X.Y : та же мажорная ветка
    const upper: McVersion = { nums: [base.nums[0] + 1], pre: null };
    return lower && compareMc(version, upper) < 0;
  }
  if (!m) return null;
  const op = m[1] ?? '=';
  const target = parseMcVersion(m[2]);
  if (!target) return null;
  const c = compareMc(version, target);
  switch (op) {
    case '>=': return c >= 0;
    case '<=': return c <= 0;
    case '>': return c > 0;
    case '<': return c < 0;
    default: return c === 0;
  }
}

/**
 * Совместима ли версия с диапазоном. Условия через пробел или запятую — все должны выполниться.
 * Возвращает null, если версия или диапазон не распознаны.
 */
export function satisfies(version: string, range: string): boolean | null {
  const v = parseMcVersion(version);
  if (!v) return null;
  const conds = range.split(/[\s,]+/).filter(Boolean);
  if (conds.length === 0 || conds.includes('*')) return true;
  let result = true;
  for (const cond of conds) {
    const r = satisfiesOne(v, cond);
    if (r === null) return null;
    result = result && r;
  }
  return result;
}

/** Нужная major-версия Java для версии Minecraft. */
export function javaMajorFor(mc: string): number {
  const v = parseMcVersion(mc);
  if (!v) return 21;
  if (v.nums[0] >= 26) return 25;
  if (v.nums[0] === 1 && v.nums[1] >= 21) return 21;
  if (v.nums[0] === 1 && v.nums[1] === 20 && (v.nums[2] ?? 0) >= 5) return 21;
  if (v.nums[0] === 1 && v.nums[1] >= 18) return 17;
  return 8;
}
