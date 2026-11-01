import { describe, expect, it } from 'vitest';
import { mavenPath, resolveLibraries } from '../libraries';
import type { RuleContext } from '../rules';

const win: RuleContext = { osName: 'windows', arch: 'x64', features: {} };
const linux: RuleContext = { osName: 'linux', arch: 'x64', features: {} };

describe('mavenPath', () => {
  it('строит путь из group:artifact:version', () => {
    expect(mavenPath('org.ow2.asm:asm:9.6')).toBe('org/ow2/asm/asm/9.6/asm-9.6.jar');
  });
  it('учитывает classifier', () => {
    expect(mavenPath('org.lwjgl:lwjgl:3.3.3:natives-windows')).toBe(
      'org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar',
    );
  });
});

describe('resolveLibraries', () => {
  const plain = {
    name: 'a:b:1',
    downloads: { artifact: { path: 'a/b/1/b-1.jar', url: 'https://libraries.minecraft.net/a/b/1/b-1.jar', sha1: 'x', size: 1 } },
  };

  it('пропускает библиотеки, запрещённые правилами ОС', () => {
    const linuxOnly = {
      ...plain,
      name: 'c:d:1',
      rules: [{ action: 'allow' as const, os: { name: 'linux' as const } }],
      downloads: { artifact: { path: 'c/d/1/d-1.jar', url: 'https://libraries.minecraft.net/c/d/1/d-1.jar' } },
    };
    const res = resolveLibraries([plain, linuxOnly], win);
    expect(res.artifacts.map((a) => a.path)).toEqual(['a/b/1/b-1.jar']);
  });

  it('нативы выбираются по классификатору ОС и подставляют ${arch}', () => {
    const lwjgl = {
      name: 'org.lwjgl:lwjgl:3.3.3',
      natives: { windows: 'natives-windows-${arch}', linux: 'natives-linux' },
      downloads: {
        artifact: { path: 'org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar', url: 'https://libraries.minecraft.net/x.jar' },
        classifiers: {
          'natives-windows-64': { path: 'org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows-64.jar', url: 'https://libraries.minecraft.net/n.jar', sha1: 'y' },
          'natives-linux': { path: 'org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-linux.jar', url: 'https://libraries.minecraft.net/l.jar' },
        },
      },
      extract: { exclude: ['META-INF/'] },
    };
    const onWin = resolveLibraries([lwjgl], win);
    expect(onWin.artifacts).toHaveLength(0);
    expect(onWin.natives).toHaveLength(1);
    expect(onWin.natives[0]?.path).toContain('natives-windows-64');
    expect(onWin.natives[0]?.exclude).toEqual(['META-INF/']);
    expect(resolveLibraries([lwjgl], linux).natives[0]?.path).toContain('natives-linux');
  });

  it('дедуплицирует одинаковые пути', () => {
    expect(resolveLibraries([plain, plain], win).artifacts).toHaveLength(1);
  });

  it('legacy-библиотека без downloads строится по url + maven-имени', () => {
    const legacy = { name: 'x:y:2', url: 'https://maven.example.com/' };
    expect(resolveLibraries([legacy], win).artifacts[0]).toEqual({
      path: 'x/y/2/y-2.jar',
      url: 'https://maven.example.com/x/y/2/y-2.jar',
    });
  });
});
