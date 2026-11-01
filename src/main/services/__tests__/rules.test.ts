import { describe, expect, it } from 'vitest';
import { currentOs, isAllowed, type RuleContext } from '../rules';

const win: RuleContext = { osName: 'windows', arch: 'x64', features: {} };
const linux: RuleContext = { osName: 'linux', arch: 'x64', features: {} };

describe('isAllowed', () => {
  it('без правил разрешено', () => {
    expect(isAllowed(undefined, win)).toBe(true);
    expect(isAllowed([], win)).toBe(true);
  });

  it('правила с allow по OS: совпадение только на нужной ОС', () => {
    const rules = [{ action: 'allow' as const, os: { name: 'windows' as const } }];
    expect(isAllowed(rules, win)).toBe(true);
    expect(isAllowed(rules, linux)).toBe(false);
  });

  it('последнее совпавшее правило побеждает', () => {
    const rules = [
      { action: 'allow' as const },
      { action: 'disallow' as const, os: { name: 'osx' as const } },
    ];
    expect(isAllowed(rules, win)).toBe(true);
  });

  it('feature-флаги: отсутствующий флаг считается false', () => {
    const rules = [{ action: 'allow' as const, features: { is_demo_user: true } }];
    expect(isAllowed(rules, win)).toBe(false);
    expect(isAllowed(rules, { ...win, features: { is_demo_user: true } })).toBe(true);
  });

  it('currentOs маппит платформы Node на имена Mojang', () => {
    expect(currentOs('win32')).toBe('windows');
    expect(currentOs('darwin')).toBe('osx');
    expect(currentOs('linux')).toBe('linux');
  });
});
