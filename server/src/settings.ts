import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { nanoid } from 'nanoid';
import { config } from './config.js';

export const BUILTIN_IDS = ['gemini', 'anthropic', 'openai'] as const;
export type BuiltinId = (typeof BUILTIN_IDS)[number];
export type Format = 'gemini' | 'anthropic' | 'openai';

export const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini (Google)',
  anthropic: 'Claude (Anthropic)',
  openai: 'OpenAI',
};

// Key que el cliente manda POR PEDIDO (no se guarda en el server).
export interface ProviderOverride {
  id?: string;
  format?: Format;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface CustomProvider {
  id: string;
  label: string;
  format: Format;      // cómo se llama a la API
  baseUrl: string;     // base del endpoint (ej https://openrouter.ai/api/v1)
  apiKey: string;
  model: string;
}

interface Settings {
  activeProvider: string;
  fallback: boolean;
  keys: Record<string, string>;
  models: Record<string, string>;
  custom: CustomProvider[];
}

const DATA_DIR = resolve(config.serverRoot, 'data');
const FILE = resolve(DATA_DIR, 'settings.json');

const isBuiltin = (id: string): id is BuiltinId => (BUILTIN_IDS as readonly string[]).includes(id);
function envKey(id: BuiltinId): string {
  return id === 'gemini' ? config.gemini.apiKey : id === 'anthropic' ? config.anthropic.apiKey : config.openai.apiKey;
}
function envModel(id: BuiltinId): string {
  return id === 'gemini' ? config.gemini.model : id === 'anthropic' ? config.anthropic.model : config.openai.model;
}

let cache: Settings | null = null;

function load(): Settings {
  if (cache) return cache;
  const def: Settings = {
    activeProvider: (config.provider === 'none' ? 'gemini' : config.provider),
    fallback: true, keys: {}, models: {}, custom: [],
  };
  try {
    if (existsSync(FILE)) {
      const raw = JSON.parse(readFileSync(FILE, 'utf8'));
      cache = {
        activeProvider: typeof raw.activeProvider === 'string' ? raw.activeProvider : def.activeProvider,
        fallback: typeof raw.fallback === 'boolean' ? raw.fallback : true,
        keys: raw.keys ?? {},
        models: raw.models ?? {},
        custom: Array.isArray(raw.custom) ? raw.custom : [],
      };
      return cache;
    }
  } catch { /* defaults */ }
  cache = def;
  return cache;
}

function persist(s: Settings): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(s, null, 2));
  cache = s;
}

export interface Resolved {
  id: string; label: string; format: Format;
  apiKey: string; model: string; baseUrl?: string; configured: boolean; custom: boolean;
}

export function resolveProvider(id: string): Resolved | null {
  const s = load();
  if (isBuiltin(id)) {
    const apiKey = (s.keys[id]?.trim()) || envKey(id);
    const model = (s.models[id]?.trim()) || envModel(id);
    return { id, label: PROVIDER_LABELS[id]!, format: id, apiKey, model, configured: !!apiKey, custom: false };
  }
  const c = s.custom.find((x) => x.id === id);
  if (!c) return null;
  return { id: c.id, label: c.label || c.id, format: c.format, apiKey: c.apiKey, model: c.model, baseUrl: c.baseUrl, configured: !!c.apiKey, custom: true };
}

function allIds(): string[] {
  return [...BUILTIN_IDS, ...load().custom.map((c) => c.id)];
}

export const getActiveProvider = (): string => load().activeProvider;
export const getFallback = (): boolean => load().fallback;
export const anyConfigured = (): boolean => allIds().some((id) => resolveProvider(id)?.configured);

export function effectiveActive(): string {
  const active = getActiveProvider();
  if (resolveProvider(active)?.configured) return active;
  const first = allIds().find((id) => resolveProvider(id)?.configured);
  return first ?? 'none';
}

/** Orden de intento: preferido/activo primero, luego el resto (solo configurados). */
export function providerOrder(preferred?: string): string[] {
  const ids = allIds();
  const first = preferred && ids.includes(preferred) ? preferred : getActiveProvider();
  const ordered = [first, ...ids.filter((id) => id !== first)];
  return ordered.filter((id) => resolveProvider(id)?.configured);
}

export function listProviders() {
  return allIds().map((id) => {
    const r = resolveProvider(id)!;
    return { id, label: r.label, configured: r.configured, model: r.model, custom: r.custom, format: r.format, baseUrl: r.baseUrl };
  });
}

export function getSettingsPublic() {
  const s = load();
  return { activeProvider: s.activeProvider, fallback: s.fallback, providers: listProviders() };
}

export interface SettingsPatch {
  activeProvider?: string;
  fallback?: boolean;
  keys?: Record<string, string>;
  models?: Record<string, string>;
  custom?: Array<Partial<CustomProvider>>;
}

export function updateSettings(patch: SettingsPatch) {
  const s = { ...load(), keys: { ...load().keys }, models: { ...load().models }, custom: [...load().custom] };

  if (typeof patch.fallback === 'boolean') s.fallback = patch.fallback;

  if (patch.keys) for (const id of BUILTIN_IDS) {
    if (id in patch.keys) { const v = String(patch.keys[id] ?? '').trim(); if (v) s.keys[id] = v; else delete s.keys[id]; }
  }
  if (patch.models) for (const id of BUILTIN_IDS) {
    if (id in patch.models) { const v = String(patch.models[id] ?? '').trim(); if (v) s.models[id] = v; else delete s.models[id]; }
  }

  // Reemplazo total de la lista custom, preservando la key si no se reenvía.
  if (Array.isArray(patch.custom)) {
    const prev = new Map(s.custom.map((c) => [c.id, c]));
    s.custom = patch.custom
      .filter((c) => (c.label || c.baseUrl))
      .map((c) => {
        const id = c.id && prev.has(c.id) ? c.id : nanoid(8);
        const old = prev.get(id);
        const apiKey = (c.apiKey && c.apiKey.trim()) ? c.apiKey.trim() : (old?.apiKey ?? '');
        return {
          id,
          label: (c.label ?? old?.label ?? 'Personalizado').toString(),
          format: (['gemini', 'anthropic', 'openai'].includes(c.format as string) ? c.format : 'openai') as Format,
          baseUrl: (c.baseUrl ?? old?.baseUrl ?? '').toString(),
          apiKey,
          model: (c.model ?? old?.model ?? '').toString(),
        };
      });
  }

  // Validar activeProvider al final.
  if (patch.activeProvider !== undefined) s.activeProvider = String(patch.activeProvider);
  if (!allIdsFrom(s).includes(s.activeProvider)) s.activeProvider = 'gemini';

  persist(s);
  return getSettingsPublic();
}

function allIdsFrom(s: Settings): string[] {
  return [...BUILTIN_IDS, ...s.custom.map((c) => c.id)];
}
