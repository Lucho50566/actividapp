import { Sun, Moon } from 'lucide-react';
import { usePrefs, setPrefs } from '../lib/prefs';

export function ThemeToggle() {
  const prefs = usePrefs();
  const isDark = document.documentElement.classList.contains('dark');
  const toggle = () => setPrefs({ themeMode: isDark ? 'light' : 'dark' });
  return (
    <button onClick={toggle} aria-label="Cambiar tema"
      className="tap grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
      <span className="sr-only">{prefs.themeMode}</span>
    </button>
  );
}
