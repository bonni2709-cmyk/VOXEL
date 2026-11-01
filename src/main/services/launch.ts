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
import { loadVersion } from './version-chain';
import { findJavaExecutable, javaRuntimeDir } from './java';
import { analyzeCrash } from './crash';

let current: ChildProcess | null = null;
let recent: string[] = [];

export interface LaunchProfile {
  name: string;
  uuid: string;
  /** Токен Minecraft для Microsoft-аккаунта; для офлайн не задаётся. */
  accessToken?: string;
}

export interface LaunchCommand {
  command: string;
  args: string[];
  cwd: string;
}

export function instanceDir(paths: DataPaths, id: string): string {
  return join(paths.instances, id);
}

/** javaPath = 'auto' → Java нужной major-версии из Java Manager. */
export async function resolveJava(javaPath: string, major: number, paths: DataPaths): Promise<string> {
  if (javaPath && javaPath !== 'auto') return javaPath;
  const exe = await findJavaExecutable(javaRuntimeDir(paths, major));
  if (!exe) throw new Error(`Не установлена Java ${major}. Установите её в Java Manager.`);
  return exe;
}

/** Собирает argv без shell: JVM-флаги, classpath, mainClass, game-аргументы. */
export async function buildLaunchCommand(
  opts: LaunchOptions,
  profile: LaunchProfile,
  paths: DataPaths,
  ctx: RuleContext,
  vj: VersionJson,
  jarId: string,
): Promise<LaunchCommand> {
  const sep = ctx.osName === 'windows' ? ';' : ':';
  const classpath = [
    ...resolveLibraries(vj.libraries, ctx).artifacts.map((a) => join(paths.libraries, a.path)),
    join(versionDir(paths, jarId), `${jarId}.jar`),
  ].join(sep);
  const natives = nativesDir(paths, jarId);
  const gameDir = instanceDir(paths, opts.versionId);
  await fs.mkdir(gameDir, { recursive: true });

  const values: Record<string, string> = {
    auth_player_name: profile.name,
    version_name: opts.versionId,
    game_directory: gameDir,
    assets_root: paths.assets,
    assets_index_name: vj.assetIndex?.id ?? vj.assets ?? 'legacy',
    auth_uuid: profile.uuid,
    auth_access_token: profile.accessToken ?? '0',
    auth_session: '0',
    auth_xuid: '0',
    clientid: '0',
    user_type: profile.accessToken ? 'msa' : 'legacy',
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
    command: '',
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
  profile: LaunchProfile,
  paths: DataPaths,
  ctx: RuleContext,
  onLog: (l: LogLine) => void,
  onExit: (e: LaunchExit, findings: import('../../shared/types').CrashFinding[]) => void,
): Promise<number> {
  if (current) throw new Error('Игра уже запущена');
  const { vj, jarId } = await loadVersion(paths, opts.versionId).catch(() => {
    throw new Error(`Версия ${opts.versionId} не установлена`);
  });
  await fs.access(join(versionDir(paths, jarId), `${jarId}.jar`)).catch(() => {
    throw new Error(`Версия ${opts.versionId} не установлена`);
  });

  const major = vj.javaVersion?.majorVersion ?? 8;
  const command = await resolveJava(opts.javaPath, major, paths);
  const cmd = await buildLaunchCommand(opts, profile, paths, ctx, vj, jarId);

  const child = spawn(command, cmd.args, { cwd: cmd.cwd, shell: false, windowsHide: true });
  current = child;
  recent = [];
  const time = () => new Date().toLocaleTimeString('ru-RU');
  const emitLine = (text: string) => {
    recent.push(text);
    if (recent.length > 2000) recent.shift();
    onLog({ level: classifyLine(text), text, time: time() });
  };

  onLog({ level: 'info', text: `Запуск ${opts.versionId} · Java ${major}: ${command} · ${opts.ramMb} МБ`, time: time() });
  if (child.stdout) createInterface({ input: child.stdout }).on('line', emitLine);
  if (child.stderr) createInterface({ input: child.stderr }).on('line', emitLine);

  child.on('error', (err) => {
    current = null;
    onLog({ level: 'error', text: `Не удалось запустить Java: ${err.message}`, time: time() });
    onExit({ code: null, signal: null }, []);
  });
  child.on('exit', (code, signal) => {
    current = null;
    onLog({ level: code === 0 ? 'success' : 'error', text: `Java завершена · exit=${code ?? 'null'} · signal=${signal ?? 'none'}`, time: time() });
    const findings = code === 0 ? [] : analyzeCrash(recent);
    onExit({ code, signal }, findings);
  });

  return child.pid ?? -1;
}

export function stopGame(): boolean {
  if (!current) return false;
  current.kill();
  return true;
}
