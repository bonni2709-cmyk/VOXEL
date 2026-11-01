import type { CrashFinding } from '../../shared/types';

interface Rule {
  pattern: RegExp;
  title: string;
  hint: string;
}

const RULES: Rule[] = [
  { pattern: /OutOfMemoryError/, title: 'Нехватка памяти (OOM)', hint: 'Увеличьте выделенную ОЗУ в настройках или уменьшите число модов.' },
  { pattern: /Mixin apply failed|InvalidInjectionException|MixinApplyError/, title: 'Ошибка Mixin', hint: 'Мод несовместим с этой версией игры или другим модом. Обновите или удалите конфликтующий мод.' },
  { pattern: /NoClassDefFoundError|ClassNotFoundException/, title: 'Отсутствует класс', hint: 'Не установлена зависимость мода (например, Fabric API).' },
  { pattern: /NoSuchMethodError|NoSuchFieldError/, title: 'Несовместимый API', hint: 'Мод собран под другую версию игры или загрузчика.' },
  { pattern: /UnsupportedClassVersionError/, title: 'Неверная версия Java', hint: 'Версия игры требует другую Java. Выберите нужную в Java Manager.' },
  { pattern: /Failed to find Java|Cannot run program .*java/i, title: 'Java не найдена', hint: 'Укажите путь к java.exe в настройках или установите Java в Java Manager.' },
  { pattern: /Duplicate mod|Mod .* requires/i, title: 'Конфликт модов', hint: 'Проверьте дубликаты и зависимости в папке mods.' },
];

/** Статический анализ лога: ищет известные сигнатуры падений. */
export function analyzeCrash(lines: string[]): CrashFinding[] {
  const findings: CrashFinding[] = [];
  for (const rule of RULES) {
    const hit = lines.find((l) => rule.pattern.test(l));
    if (hit) findings.push({ title: rule.title, hint: rule.hint, line: hit.slice(0, 300) });
  }
  return findings;
}
