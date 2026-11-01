import type { ThemeId } from '@shared/types';

interface Palette {
  label: string;
  caption: string;
  dark: boolean;
  bg: string;
  panel: string;
  text: string;
  muted: string;
  accent: string;
}

export const PALETTES: Record<ThemeId, Palette> = {
  emerald: { label: 'Emerald', caption: 'Привычная глубина', dark: true, bg: '#0F1115', panel: '#161A21', text: '#E6E9EF', muted: '#8A93A3', accent: '#6FD3A4' },
  sapphire: { label: 'Sapphire', caption: 'Спокойствие океана', dark: true, bg: '#0F1115', panel: '#161A21', text: '#E6E9EF', muted: '#8A93A3', accent: '#92BCF8' },
  ruby: { label: 'Ruby', caption: 'Энергия приключений', dark: true, bg: '#120F11', panel: '#1B1518', text: '#F1E6E8', muted: '#A38A90', accent: '#E8838A' },
  amethyst: { label: 'Amethyst', caption: 'Немного магии', dark: true, bg: '#100F14', panel: '#18161F', text: '#ECE6F4', muted: '#9489A8', accent: '#B99CF0' },
  light: { label: 'Light Mode', caption: 'Больше дневного света', dark: false, bg: '#F3F5F7', panel: '#FFFFFF', text: '#1B1F26', muted: '#667085', accent: '#3B82C4' },
};

/** Применяет палитру и акцент (HEX) через CSS-переменные. */
export function applyTheme(theme: ThemeId, accent: string | null): void {
  const p = PALETTES[theme];
  const root = document.documentElement;
  root.style.setProperty('--vx-bg', p.bg);
  root.style.setProperty('--vx-panel', p.panel);
  root.style.setProperty('--vx-text', p.text);
  root.style.setProperty('--vx-muted', p.muted);
  root.style.setProperty('--vx-accent', accent ?? p.accent);
  root.dataset['theme'] = theme;
  root.style.colorScheme = p.dark ? 'dark' : 'light';
}
