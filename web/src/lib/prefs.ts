import { useSyncExternalStore } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type FontSize = 'normal' | 'large';

export interface Prefs {
  accent: string;         // hex del color de acento
  themeMode: ThemeMode;
  animations: boolean;
  fontSize: FontSize;
  showCrops: boolean;     // mostrar recortes de imágenes hechos por la IA
}

export const ACCENT_PRESETS: { name: string; hex: string }[] = [
  { name: 'Violeta', hex: '#7c3aed' },
  { name: 'Índigo', hex: '#4f46e5' },
  { name: 'Azul', hex: '#2563eb' },
  { name: 'Esmeralda', hex: '#059669' },
  { name: 'Rosa', hex: '#e11d48' },
  { name: 'Ámbar', hex: '#d97706' },
  { name: 'Cian', hex: '#0891b2' },
  { name: 'Grafito', hex: '#475569' },
];

export const DEFAULT_PREFS: Prefs = {
  accent: '#7c3aed', themeMode: 'system', animations: true, fontSize: 'normal', showCrops: true,
};
const DEFAULTS = DEFAULT_PREFS;

const KEY = 'actividapp.prefs';

function load(): Prefs {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; }
  catch { return { ...DEFAULTS }; }
}

let current: Prefs = load();
const listeners = new Set<() => void>();

// ---- color: hex -> HSL -> paleta de tonos ----
function hexToHsl(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) / 255, g = parseInt(m.slice(2, 4), 16) / 255, b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0; const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, s, l];
}
function hslToRgbStr(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return `${Math.round((r + m) * 255)} ${Math.round((g + m) * 255)} ${Math.round((b + m) * 255)}`;
}
function palette(hex: string): Record<string, string> {
  const [h, s] = hexToHsl(hex);
  return {
    '--brand-50': hslToRgbStr(h, Math.min(s, 0.9), 0.965),
    '--brand-200': hslToRgbStr(h, s, 0.85),
    '--brand-500': hslToRgbStr(h, s, 0.64),
    '--brand-600': hslToRgbStr(h, s, 0.55),
    '--brand-700': hslToRgbStr(h, s, 0.45),
  };
}

export function applyPrefs(p: Prefs = current): void {
  const root = document.documentElement;
  const pal = palette(p.accent);
  for (const [k, v] of Object.entries(pal)) root.style.setProperty(k, v);
  root.style.setProperty('--brand-hex', p.accent);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.classList.toggle('dark', p.themeMode === 'dark' || (p.themeMode === 'system' && prefersDark));
  root.classList.toggle('no-anim', !p.animations);
  root.dataset.fs = p.fontSize;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', p.accent);
}

export function getPrefs(): Prefs { return current; }
export function setPrefs(patch: Partial<Prefs>): void {
  current = { ...current, ...patch };
  localStorage.setItem(KEY, JSON.stringify(current));
  applyPrefs(current);
  listeners.forEach((l) => l());
}

export function initPrefs(): void {
  applyPrefs(current);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (current.themeMode === 'system') applyPrefs(current);
  });
}

function subscribe(cb: () => void): () => void { listeners.add(cb); return () => listeners.delete(cb); }
export function usePrefs(): Prefs { return useSyncExternalStore(subscribe, getPrefs, getPrefs); }
