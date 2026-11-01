import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { LaunchExit, LaunchOptions, LogLevel, LogLine } from '../../shared/types';
import { buildArguments } from './args';
import { resolveLibraries } from './libraries';
import { nativesDir, versionDir, type DataPaths } from './paths';
import type { VersionJson } from './mojang';
import type { RuleContext } from './rules';

let current: ChildProcess | null = null;

export interface LaunchCommand {
  command: string;
  args: string[];
  cwd: string;
}

/** Собирает argv без shell: JVM-флаги, classpath, mainClass, game-аргументы. */
export async function buildLaunchCommand(
  opts: LaunchOptions,
  profile: { name: string; uuid: string },
  paths: DataPaths,
  ctx: RuleContext,
  vj: VersionJson,
): Promise<LaunchCommand> {
  const sep = ctx.osName === 'windows' ? ';' : ':';
  const classpath = [
    ...resolveLibraries(vj.libraries, ctx).artifacts.map((a) => join(paths.libraries, a.path)),
    join(versionDir(paths, opts.versionId), `${opts.versionId}.jar`),
  ].join(sep);
  const natives = nativesDir(paths, opts.versionId);
  const gameDir = join(paths.instances, opts.versionId);
  await fs.mkdir(gameDir, { recursive: true });

  const values: Record<string, string> = {
    auth_player_name: profile.name,
    version_name: opts.versionId,
    game_directory: gameDir,
    assets_root: paths.assets,
    assets_index_name: vj.assetIndex?.id ?? vj.assets ?? 'legacy',
    auth_uuid: profile.uuid,
    auth_access_token: '0',
    auth_session: '0',
    auth_xuid: '0',
    clientid: '0',
    user_type: 'legacy',
    user_properties: '{}',
    version_type: vj.type,
    natives_directory: natives,
    launcher_name: 'VOXEL',
    launcher_version: '4.0.0',
    classpath,
    classpath_separator: sep,
    library_directory: paths.libraries,
    resolution_width: String(opts.width),
    resolution_height: String(opts.height),
  };

  const { jvm, game } = buildArguments(vj.arguments, vj.minecraftArguments, ctx, values);
  const jvmArgs = [`-Xmx${opts.ramMb}M`];
  if (!jvm.some((a) => a.startsWith('-Djava.library.path='))) jvmArgs.push(`-Djava.library.path=${natives}`);
  if (!jvm.some((a) => a === '-cp' || a === '-classpath')) jvmArgs.push('-cp', classpath);

  return {
    command: opts.javaPath,
    args: [...jvmArgs, ...jvm, vj.mainClass, ...game],
    cwd: gameDir,
  };
}

export function classifyLine(line: string): LogLevel {
  if (/\b(ERROR|FATAL)\b|Exception/.test(line)) return 'error';
  if (/\bWARN\b/.test(line)) return 'warn';
  if (/\bSUCCESS\b/.test(line)) return 'success';
  return 'java';
}

export function isRunning(): boolean {
  return current !== null;
}

export async function startGame(
  opts: LaunchOptions,
  profile: { name: string; uuid: string },
  paths: DataPaths,
  ctx: RuleContext,
  onLog: (l: LogLine) => void,
  onExit: (e: LaunchExit) => void,
): Promise<number> {
  if (current) throw new Error('Игра уже запущена');
  const jsonPath = join(versionDir(paths, opts.versionId), `${opts.versionId}.json`);
  const jarPath = join(versionDir(paths, opts.versionId), `${opts.versionId}.jar`);
  try {
    await fs.access(jarPath);
  } catch {
    throw new Error(`Версия ${opts.versionId} не установлена`);
  }
  const vj = JSON.parse(await fs.readFile(jsonPath, 'utf8')) as VersionJson;
  const cmd = await buildLaunchCommand(opts, profile, paths, ctx, vj);

  const child = spawn(cmd.command, cmd.args, { cwd: cmd.cwd, shell: false, windowsHide: true });
  current = child;
  const time = () => new Date().toLocaleTimeString('ru-RU');
  const emitLine = (text: string) => onLog({ level: classifyLine(text), text, time: time() });

  onLog({ level: 'info', text: `Запуск ${opts.versionId} · Java: ${cmd.command} · ${opts.ramMb} МБ`, time: time() });
  if (child.stdout) createInterface({ input: child.stdout }).on('line', emitLine);
  if (child.stderr) createInterface({ input: child.stderr }).on('line', emitLine);

  child.on('error', (err) => {
    current = null;
    onLog({ level: 'error', text: `Не удалось запустить Java: ${err.message}`, time: time() });
    onExit({ code: null, signal: null });
  });
  child.on('exit', (code, signal) => {
    current = null;
    onLog({ level: code === 0 ? 'success' : 'error', text: `Java завершена · exit=${code ?? 'null'} · signal=${signal ?? 'none'}`, time: time() });
    onExit({ code, signal });
  });

  return child.pid ?? -1;
}

export function stopGame(): boolean {
  if (!current) return false;
  current.kill();
  return true;
}
