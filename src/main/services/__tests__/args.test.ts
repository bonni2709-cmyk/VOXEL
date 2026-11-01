import { describe, expect, it } from 'vitest';
import { buildArguments, substitute } from '../args';
import type { RuleContext } from '../rules';

const ctx: RuleContext = { osName: 'windows', arch: 'x64', features: { has_custom_resolution: true } };

describe('substitute', () => {
  it('подставляет известные плейсхолдеры', () => {
    expect(substitute('--username ${auth_player_name}', { auth_player_name: 'Steve' })).toBe('--username Steve');
  });
  it('неизвестный плейсхолдер блокирует запуск', () => {
    expect(() => substitute('${missing}', {})).toThrow(/missing/);
  });
});

describe('buildArguments', () => {
  const values = { a: '1', w: '1280', h: '720' };

  it('формат 1.13+: rule-based entries и массивы значений', () => {
    const res = buildArguments(
      {
        game: [
          '--width',
          { rules: [{ action: 'allow', features: { has_custom_resolution: true } }], value: ['--res', '${w}x${h}'] },
          { rules: [{ action: 'allow', features: { is_demo_user: true } }], value: '--demo' },
        ],
        jvm: [{ rules: [{ action: 'allow', os: { name: 'windows' } }], value: '-XX:HeapDumpPath=${a}' }],
      },
      undefined,
      ctx,
      values,
    );
    expect(res.game).toEqual(['--width', '--res', '1280x720']);
    expect(res.jvm).toEqual(['-XX:HeapDumpPath=1']);
  });

  it('legacy minecraftArguments делится по пробелам', () => {
    const res = buildArguments(undefined, '--username ${a} --version ${w}', ctx, values);
    expect(res.game).toEqual(['--username', '1', '--version', '1280']);
    expect(res.jvm).toEqual([]);
  });
});
