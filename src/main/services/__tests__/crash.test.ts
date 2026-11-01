import { describe, expect, it } from 'vitest';
import { analyzeCrash } from '../crash';

describe('analyzeCrash', () => {
  it('находит OOM и Mixin-ошибку', () => {
    const f = analyzeCrash([
      'INFO starting',
      'java.lang.OutOfMemoryError: Java heap space',
      'ERROR Mixin apply failed mod.examplemixin',
    ]);
    expect(f.map((x) => x.title)).toEqual(['Нехватка памяти (OOM)', 'Ошибка Mixin']);
  });

  it('чистый лог — без находок', () => {
    expect(analyzeCrash(['INFO Done (2.1s)!'])).toEqual([]);
  });
});
