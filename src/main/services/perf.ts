/**
 * Java Performance Tuner: флаги Aikar (G1GC) и «Турбо»-подбор памяти под железо.
 */

export const RAM_MIN_MB = 512;
export const RAM_MAX_MB = 8192;

/** Aikar's flags. Для кучи ≥ 12 ГБ — отдельный набор процентов для G1. */
export function aikarFlags(ramMb: number): string[] {
  const big = ramMb >= 12 * 1024;
  const base = [
    '-XX:+UseG1GC',
    '-XX:+ParallelRefProcEnabled',
    '-XX:MaxGCPauseMillis=200',
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:+DisableExplicitGC',
    '-XX:+AlwaysPreTouch',
    '-XX:G1HeapWastePercent=5',
    '-XX:G1MixedGCCountTarget=4',
    '-XX:InitiatingHeapOccupancyPercent=15',
    '-XX:G1MixedGCLiveThresholdPercent=90',
    '-XX:G1RSetUpdatingPauseTimePercent=5',
    '-XX:SurvivorRatio=32',
    '-XX:+PerfDisableSharedMem',
    '-XX:MaxTenuringThreshold=1',
  ];
  const sized = big
    ? ['-XX:G1NewSizePercent=40', '-XX:G1MaxNewSizePercent=50', '-XX:G1HeapRegionSize=16M', '-XX:G1ReservePercent=15']
    : ['-XX:G1NewSizePercent=30', '-XX:G1MaxNewSizePercent=40', '-XX:G1HeapRegionSize=8M', '-XX:G1ReservePercent=20'];
  return [`-Xms${ramMb}M`, `-Xmx${ramMb}M`, ...base, ...sized];
}

/**
 * Турбо: 4–5 ГБ, но не больше того, что останется системе (2 ГБ резерв).
 * На слабом устройстве берём всё доступное, но не меньше 2 ГБ.
 */
export function turboRamMb(totalMb: number): number {
  const reserve = 2048;
  const cap = Math.max(2048, totalMb - reserve);
  const wanted = Math.min(5120, Math.max(4096, Math.floor((totalMb * 0.4) / 256) * 256));
  return Math.min(wanted, cap, RAM_MAX_MB);
}

/** Приводит значение ползунка к допустимому диапазону и шагу 256 МБ. */
export function clampRam(mb: number, maxMb = RAM_MAX_MB): number {
  const v = Math.round(mb / 256) * 256;
  return Math.min(Math.max(v, RAM_MIN_MB), maxMb);
}

/** Разбирает пользовательские JVM-флаги: по одному на строку или через пробел; без пустых. */
export function parseCustomFlags(text: string): string[] {
  return text.split(/\s+/).map((s) => s.trim()).filter((s) => s.startsWith('-') && s.length <= 200);
}
