import { useEffect, useState } from 'react';
import {
  ArrowLeft, Check, Loader2, ExternalLink, Trash2, Star, Plus, Cpu, Palette, Database, LogOut, UserRound,
} from 'lucide-react';
import { api, type Settings as SettingsData, type CustomProviderInput } from '../lib/api';
import { usePrefs, setPrefs, ACCENT_PRESETS, DEFAULT_PREFS, type ThemeMode } from '../lib/prefs';
import { clearAllActivities } from '../lib/db';
import { useAuth } from '../lib/auth';

const KEY_LINKS: Record<string, string> = {
  gemini: 'https://aistudio.google.com/app/apikey',
  anthropic: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
};
const BUILTINS = ['gemini', 'anthropic', 'openai'];

type Tab = 'ia' | 'apariencia' | 'datos';

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-600'}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

export function Settings({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('ia');
  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 pb-28">
      <header className="flex items-center gap-3 py-4">
        <button onClick={onBack} aria-label="Volver" className="tap grid h-10 w-10 place-items-center rounded-full bg-slate-100 dark:bg-slate-800"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold">Configuración</h1>
      </header>

      <div className="mb-5 grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
        {([['ia', 'IA', Cpu], ['apariencia', 'Apariencia', Palette], ['datos', 'Datos', Database]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`tap flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium transition-colors ${tab === k ? 'bg-white text-brand shadow-sm dark:bg-slate-900' : 'text-slate-500'}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {tab === 'ia' && <ProvidersTab />}
      {tab === 'apariencia' && <AppearanceTab />}
      {tab === 'datos' && <DataTab />}
    </div>
  );
}

// ================= IA =================
function ProvidersTab() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [active, setActive] = useState('');
  const [fallback, setFallback] = useState(true);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [models, setModels] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<(CustomProviderInput & { configured?: boolean })[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => api.getSettings().then((s) => {
    setData(s); setActive(s.activeProvider); setFallback(s.fallback);
    setCustom(s.providers.filter((p) => p.custom).map((p) => ({
      id: p.id, label: p.label, format: p.format ?? 'openai', baseUrl: p.baseUrl ?? '', model: p.model, apiKey: '', configured: p.configured,
    })));
  });
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const s = await api.updateSettings({
        activeProvider: active, fallback,
        keys: Object.fromEntries(Object.entries(keys).filter(([, v]) => v !== '')),
        models: Object.fromEntries(Object.entries(models).filter(([, v]) => v !== '')),
        custom: custom.map((c) => ({ id: c.id, label: c.label, format: c.format, baseUrl: c.baseUrl, model: c.model, apiKey: c.apiKey })),
      });
      setData(s); setActive(s.activeProvider); setFallback(s.fallback); setKeys({}); setModels({});
      setCustom(s.providers.filter((p) => p.custom).map((p) => ({ id: p.id, label: p.label, format: p.format ?? 'openai', baseUrl: p.baseUrl ?? '', model: p.model, apiKey: '', configured: p.configured })));
      setMsg('Guardado ✓');
    } catch (e) { setMsg('Error: ' + (e as Error).message); }
    finally { setSaving(false); setTimeout(() => setMsg(''), 2500); }
  };

  if (!data) return <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="animate-spin" /></div>;
  const builtin = data.providers.filter((p) => BUILTINS.includes(p.id));

  const StarBtn = ({ id }: { id: string }) => (
    <button onClick={() => setActive(id)} aria-label="Usar por defecto"
      className={`tap grid h-8 w-8 shrink-0 place-items-center rounded-full ${active === id ? 'bg-brand text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
      <Star size={16} fill={active === id ? 'currentColor' : 'none'} />
    </button>
  );

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">Configurá una o varias IA. Elegí la de por defecto (⭐) y, si querés, que pruebe las otras cuando una falla.</p>

      <label className="mb-5 flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <Toggle on={fallback} onChange={setFallback} />
        <span className="text-[15px]">Si el proveedor elegido falla, <b>probar los otros</b> automáticamente</span>
      </label>

      <div className="space-y-3">
        {builtin.map((p) => (
          <div key={p.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
            <div className="mb-2 flex items-center gap-2">
              <StarBtn id={p.id} />
              <span className="flex-1 font-semibold">{p.label}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${p.configured ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>{p.configured ? 'configurada ✓' : 'sin key'}</span>
            </div>
            <input type="password" autoComplete="off" value={keys[p.id] ?? ''} onChange={(e) => setKeys((k) => ({ ...k, [p.id]: e.target.value }))}
              placeholder={p.configured ? '•••••••• (dejá vacío para mantener)' : 'Pegá tu API key'} className="answer-input mb-2 font-mono text-sm" />
            <input value={models[p.id] ?? ''} onChange={(e) => setModels((m) => ({ ...m, [p.id]: e.target.value }))}
              placeholder={`Modelo (por defecto: ${p.model})`} className="answer-input text-sm" />
            <div className="mt-2 text-xs">
              <a href={KEY_LINKS[p.id]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand">Conseguir key <ExternalLink size={12} /></a>
            </div>
          </div>
        ))}
      </div>

      {/* Custom */}
      <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">APIs personalizadas</h3>
      <div className="space-y-3">
        {custom.map((c, i) => {
          const upd = (patch: Partial<CustomProviderInput>) => setCustom((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <div key={c.id ?? i} className="rounded-2xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
              <div className="mb-2 flex items-center gap-2">
                {c.id ? <StarBtn id={c.id} /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-300 dark:bg-slate-800"><Star size={16} /></span>}
                <input value={c.label} onChange={(e) => upd({ label: e.target.value })} placeholder="Nombre (ej: OpenRouter)" className="answer-input flex-1 !py-1.5 font-semibold" />
                <button onClick={() => setCustom((l) => l.filter((_, j) => j !== i))} aria-label="Eliminar" className="tap text-slate-300 hover:text-red-500"><Trash2 size={18} /></button>
              </div>
              <div className="mb-2 flex gap-2">
                <select value={c.format} onChange={(e) => upd({ format: e.target.value as CustomProviderInput['format'] })} className="answer-input !py-2 text-sm">
                  <option value="openai">OpenAI-compatible</option>
                  <option value="gemini">Gemini-compatible</option>
                  <option value="anthropic">Anthropic-compatible</option>
                </select>
                <input value={c.model} onChange={(e) => upd({ model: e.target.value })} placeholder="Modelo" className="answer-input text-sm" />
              </div>
              <input value={c.baseUrl} onChange={(e) => upd({ baseUrl: e.target.value })} placeholder="Base URL (ej: https://openrouter.ai/api/v1)" className="answer-input mb-2 font-mono text-sm" />
              <input type="password" autoComplete="off" value={c.apiKey ?? ''} onChange={(e) => upd({ apiKey: e.target.value })}
                placeholder={c.configured ? '•••••••• (dejá vacío para mantener)' : 'API key'} className="answer-input font-mono text-sm" />
            </div>
          );
        })}
        <button onClick={() => setCustom((l) => [...l, { label: '', format: 'openai', baseUrl: '', model: '', apiKey: '' }])}
          className="tap flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 dark:border-slate-700">
          <Plus size={16} />Agregar API personalizada
        </button>
      </div>

      <SaveBar msg={msg} saving={saving} onSave={save} />
    </div>
  );
}

// ================= Apariencia =================
function AppearanceTab() {
  const prefs = usePrefs();
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <span className="text-[15px] font-medium">{label}</span>{children}
    </div>
  );
  const Seg = <T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) => (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={`tap rounded-lg px-3 py-1 text-sm font-medium ${value === v ? 'bg-white text-brand shadow-sm dark:bg-slate-900' : 'text-slate-500'}`}>{l}</button>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <p className="mb-3 text-[15px] font-medium">Color de acento</p>
        <div className="flex flex-wrap gap-2.5">
          {ACCENT_PRESETS.map((a) => (
            <button key={a.hex} onClick={() => setPrefs({ accent: a.hex })} title={a.name}
              className={`h-9 w-9 rounded-full ring-2 ring-offset-2 ring-offset-white transition-transform hover:scale-110 dark:ring-offset-slate-900 ${prefs.accent.toLowerCase() === a.hex ? 'ring-slate-800 dark:ring-white' : 'ring-transparent'}`}
              style={{ background: a.hex }} />
          ))}
          <label className="grid h-9 w-9 cursor-pointer place-items-center rounded-full ring-2 ring-transparent" style={{ background: 'conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)' }} title="Personalizado">
            <input type="color" value={prefs.accent} onChange={(e) => setPrefs({ accent: e.target.value })} className="h-0 w-0 opacity-0" />
          </label>
        </div>
      </div>
      <Row label="Tema"><Seg value={prefs.themeMode} onChange={(v: ThemeMode) => setPrefs({ themeMode: v })} options={[['light', 'Claro'], ['dark', 'Oscuro'], ['system', 'Auto']]} /></Row>
      <Row label="Tamaño de texto"><Seg value={prefs.fontSize} onChange={(v) => setPrefs({ fontSize: v })} options={[['normal', 'Normal'], ['large', 'Grande']]} /></Row>
      <Row label="Animaciones sutiles"><Toggle on={prefs.animations} onChange={(v) => setPrefs({ animations: v })} /></Row>
      <Row label="Mostrar recortes de imágenes (IA)"><Toggle on={prefs.showCrops} onChange={(v) => setPrefs({ showCrops: v })} /></Row>
      <p className="px-1 pt-1 text-xs text-slate-400">Si los recortes de la IA salen mal, apagalos: igual vas a ver la captura completa con zoom.</p>
    </div>
  );
}

// ================= Datos =================
function DataTab() {
  const [msg, setMsg] = useState('');
  const { authEnabled, email, signOut } = useAuth();
  const clearActs = async () => {
    if (!confirm('¿Borrar TODAS tus actividades guardadas? No se puede deshacer.')) return;
    const n = await clearAllActivities();
    setMsg(`Se borraron ${n} actividad(es).`);
  };
  const resetLook = () => { setPrefs({ ...DEFAULT_PREFS }); setMsg('Apariencia restablecida.'); };

  return (
    <div className="space-y-3">
      {authEnabled && (
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand dark:bg-brand/20"><UserRound size={20} /></span>
          <span className="min-w-0 flex-1"><b className="block truncate">{email ?? 'Mi cuenta'}</b><span className="text-sm text-slate-500">Sesión iniciada</span></span>
          <button onClick={signOut} className="tap flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"><LogOut size={16} />Salir</button>
        </div>
      )}
      <button onClick={clearActs} className="tap flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-500 dark:bg-red-900/20"><Trash2 size={20} /></span>
        <span><b className="text-red-600 dark:text-red-400">Borrar todas las actividades</b><br /><span className="text-sm text-slate-500">Elimina todo tu historial guardado en este dispositivo.</span></span>
      </button>
      <button onClick={resetLook} className="tap flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand dark:bg-brand/20"><Palette size={20} /></span>
        <span><b>Restablecer apariencia</b><br /><span className="text-sm text-slate-500">Vuelve a los colores y ajustes por defecto.</span></span>
      </button>
      {msg && <p className="pt-1 text-center text-sm text-green-600">{msg}</p>}
    </div>
  );
}

function SaveBar({ msg, saving, onSave }: { msg: string; saving: boolean; onSave: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-slate-50/95 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        {msg && <span className={`text-sm ${msg.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>{msg}</span>}
        <button onClick={onSave} disabled={saving} className="tap ml-auto flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-500 px-5 py-3 font-semibold text-white shadow-sm shadow-brand/30 disabled:opacity-50">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}Guardar
        </button>
      </div>
    </div>
  );
}
