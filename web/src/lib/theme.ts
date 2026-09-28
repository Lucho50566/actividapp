export type Theme = 'light' | 'dark' | 'system';
const KEY = 'actividapp.theme';

export const getStoredTheme = (): Theme => (localStorage.getItem(KEY) as Theme) ?? 'system';

export function applyTheme(theme: Theme): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark));
  localStorage.setItem(KEY, theme);
}

export function initTheme(): void {
  applyTheme(getStoredTheme());
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStoredTheme() === 'system') applyTheme('system');
  });
}
