import type { Activity, Answers } from '@actividapp/shared';

export interface InterpretResponse {
  activity: Activity;
  provider: string;
  demo: boolean;
  attempts?: { provider: string; error: string }[];
}

export interface ServerInfo {
  version: string; ip: string; port: number; url: string;
  qr: string; provider: string; demo: boolean;
}

export interface ProviderInfo {
  id: string;
  label: string;
  configured: boolean;
  model: string;
  custom?: boolean;
  format?: 'gemini' | 'anthropic' | 'openai';
  baseUrl?: string;
}

export interface CustomProviderInput {
  id?: string;
  label: string;
  format: 'gemini' | 'anthropic' | 'openai';
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export interface Settings {
  activeProvider: string;
  fallback: boolean;
  providers: ProviderInfo[];
}

export interface SettingsPatch {
  activeProvider?: string;
  fallback?: boolean;
  keys?: Record<string, string>;
  models?: Record<string, string>;
  custom?: CustomProviderInput[];
}

export type GradeStatus = 'correct' | 'partial' | 'incorrect' | 'unanswered';
export interface GradeItem { id: string; status: GradeStatus; feedback: string }
export interface GradeResult {
  results: GradeItem[];
  summary: string;
  score: { correct: number; partial: number; total: number };
  provider: string;
}

export interface ProviderOverride {
  id: string;
  format: 'gemini' | 'anthropic' | 'openai';
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

// ============================================================================
//  Proveedores de IA POR DISPOSITIVO (localStorage).
//  La API key nunca se guarda en el servidor: viaja en cada pedido y queda
//  solo en tu navegador. Así la app se puede compartir sin exponer keys.
// ============================================================================

type Format = 'gemini' | 'anthropic' | 'openai';
interface LocalProvider {
  id: string; label: string; format: Format;
  baseUrl: string; model: string; apiKey: string; custom: boolean;
}
interface ProvidersState { activeProvider: string; fallback: boolean; list: LocalProvider[] }

const PKEY = 'actividapp.providers';

const BUILTIN_DEFAULTS: LocalProvider[] = [
  { id: 'gemini', label: 'Gemini (Google)', format: 'gemini', baseUrl: '', model: 'gemini-3.7-flash', apiKey: '', custom: false },
  { id: 'anthropic', label: 'Claude (Anthropic)', format: 'anthropic', baseUrl: '', model: 'claude-3-5-sonnet-latest', apiKey: '', custom: false },
  { id: 'openai', label: 'OpenAI', format: 'openai', baseUrl: '', model: 'gpt-4o-mini', apiKey: '', custom: false },
];

function loadState(): ProvidersState {
  try {
    const raw = JSON.parse(localStorage.getItem(PKEY) ?? '{}') as Partial<ProvidersState>;
    const saved = Array.isArray(raw.list) ? raw.list : [];
    const builtins: LocalProvider[] = BUILTIN_DEFAULTS.map((b) => {
      const found = saved.find((x) => x.id === b.id) as LocalProvider | undefined;
      return found ? { ...b, ...found, custom: false } : { ...b };
    });
    const custom = (saved as LocalProvider[]).filter((x) => x.custom);
    return {
      activeProvider: typeof raw.activeProvider === 'string' ? raw.activeProvider : 'gemini',
      fallback: raw.fallback !== false,
      list: [...builtins, ...custom],
    };
  } catch {
    return { activeProvider: 'gemini', fallback: true, list: BUILTIN_DEFAULTS.map((b) => ({ ...b })) };
  }
}

function saveState(s: ProvidersState): void { localStorage.setItem(PKEY, JSON.stringify(s)); }

export function getSettings(): Settings {
  const s = loadState();
  return {
    activeProvider: s.activeProvider,
    fallback: s.fallback,
    providers: s.list.map((p) => ({
      id: p.id, label: p.label, configured: !!p.apiKey, model: p.model,
      custom: p.custom, format: p.format, baseUrl: p.baseUrl || undefined,
    })),
  };
}

export function updateSettings(patch: SettingsPatch): Settings {
  const s = loadState();
  if (typeof patch.fallback === 'boolean') s.fallback = patch.fallback;
  if (patch.keys) for (const [id, v] of Object.entries(patch.keys)) {
    const p = s.list.find((x) => x.id === id); if (p && v != null && String(v).trim()) p.apiKey = String(v).trim();
  }
  if (patch.models) for (const [id, v] of Object.entries(patch.models)) {
    const p = s.list.find((x) => x.id === id); if (p && v != null && String(v).trim()) p.model = String(v).trim();
  }
  if (Array.isArray(patch.custom)) {
    const prev = new Map(s.list.filter((x) => x.custom).map((x) => [x.id, x]));
    const customs: LocalProvider[] = patch.custom
      .filter((c) => c.label || c.baseUrl || c.apiKey)
      .map((c) => {
        const id = c.id && prev.has(c.id) ? c.id : 'c' + Math.random().toString(36).slice(2, 9);
        const old = prev.get(id);
        return {
          id, custom: true,
          label: (c.label ?? old?.label ?? 'Personalizado').toString() || 'Personalizado',
          format: (['gemini', 'anthropic', 'openai'].includes(c.format as string) ? c.format : 'openai') as Format,
          baseUrl: (c.baseUrl ?? old?.baseUrl ?? '').toString(),
          model: (c.model ?? old?.model ?? '').toString(),
          apiKey: c.apiKey && c.apiKey.trim() ? c.apiKey.trim() : (old?.apiKey ?? ''),
        };
      });
    s.list = [...s.list.filter((x) => !x.custom), ...customs];
  }
  if (patch.activeProvider) s.activeProvider = patch.activeProvider;
  if (!s.list.some((x) => x.id === s.activeProvider)) s.activeProvider = 'gemini';
  saveState(s);
  return getSettings();
}

/** Override para el pedido: la key del proveedor pedido (o el activo) si tiene key. */
export function overrideFor(id?: string): ProviderOverride | undefined {
  const s = loadState();
  const p = s.list.find((x) => x.id === (id || s.activeProvider)) ?? s.list.find((x) => x.id === s.activeProvider);
  if (!p || !p.apiKey) return undefined;
  return { id: p.id, format: p.format, apiKey: p.apiKey, model: p.model || undefined, baseUrl: p.baseUrl || undefined };
}

/** ¿Hay al menos un proveedor con key (en este dispositivo)? */
export function anyConfigured(): boolean { return loadState().list.some((p) => !!p.apiKey); }

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Error ${res.status}`);
  }
  return res.json();
}

export const api = {
  async interpret(imageDataUrl: string, provider?: string, fallback?: boolean): Promise<InterpretResponse> {
    const res = await fetch('/api/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageDataUrl, provider, fallback, override: overrideFor(provider) }),
    });
    return jsonOrThrow<InterpretResponse>(res);
  },
  async info(): Promise<ServerInfo> {
    return jsonOrThrow<ServerInfo>(await fetch('/api/info'));
  },
  async getSettings(): Promise<Settings> { return getSettings(); },
  async updateSettings(patch: SettingsPatch): Promise<Settings> { return updateSettings(patch); },
  async grade(activity: Activity, answers: Answers, image?: string, provider?: string): Promise<GradeResult> {
    const res = await fetch('/api/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity, answers, image, provider, override: overrideFor(provider) }),
    });
    return jsonOrThrow<GradeResult>(res);
  },
};
