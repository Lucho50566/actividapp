import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Plus, FileText, Trash2, Sparkles, Info, Settings as SettingsIcon, Sparkle, Search, X, Smartphone, BookOpen } from 'lucide-react';
import { listActivities, deleteActivity, type ActivitySummary } from '../lib/db';
import { getSettings, anyConfigured } from '../lib/api';
import { ThemeToggle } from './ThemeToggle';
import { ShareApp } from './ShareApp';

/** Normaliza para buscar sin importar mayúsculas ni acentos. */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function Home({ onNew, onOpen, onSettings }: { onNew: () => void; onOpen: (id: string) => void; onSettings: () => void }) {
  const [items, setItems] = useState<ActivitySummary[]>([]);
  const [demo, setDemo] = useState(false);
  const [provider, setProvider] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState<string | null>(null);
  const [share, setShare] = useState(false);

  const refresh = () => listActivities().then((x) => { setItems(x); setLoading(false); });
  useEffect(() => {
    refresh();
    const s = getSettings();
    setProvider(s.activeProvider);
    setDemo(!anyConfigured());
  }, []);

  const remove = async (id: string) => {
    await deleteActivity(id);
    refresh();
  };

  // Materias distintas (para los chips de filtro) y lista filtrada por materia + búsqueda.
  const subjects = useMemo(
    () => Array.from(new Set(items.map((it) => it.subject).filter((s): s is string => !!s))).sort((a, b) => a.localeCompare(b, 'es')),
    [items],
  );
  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return items.filter((it) =>
      (!subject || it.subject === subject) &&
      (!q || norm(it.title).includes(q) || (it.subject && norm(it.subject).includes(q))),
    );
  }, [items, query, subject]);

  // Si la materia activa desaparece (p. ej. al borrar), volver a "Todas".
  useEffect(() => { if (subject && !subjects.includes(subject)) setSubject(null); }, [subjects, subject]);

  const showControls = items.length >= 5 || subjects.length > 1;
  const providerLabel: Record<string, string> = { gemini: 'Gemini', anthropic: 'Claude', openai: 'OpenAI', none: 'demo' };
  const providerText = providerLabel[provider] ?? provider;

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-28">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-500 text-white shadow-lg shadow-brand/30"><BookOpen size={22} /></span>
          <h1 className="bg-gradient-to-r from-brand to-brand-500 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">Actividapp</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShare(true)} aria-label="Instalar o compartir la app" title="Instalar / compartir"
            className="tap grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand dark:bg-brand/20">
            <Smartphone size={18} />
          </button>
          <button onClick={onSettings} aria-label="Configuración"
            className="tap grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <SettingsIcon size={18} />
          </button>
          <ThemeToggle />
        </div>
      </header>

      {demo ? (
        <button onClick={onSettings} className="mb-4 flex w-full items-start gap-2 rounded-2xl bg-amber-50 p-3 text-left text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          <Info size={18} className="mt-0.5 shrink-0" />
          <p className="text-sm">
            <b>Modo demo:</b> no hay ninguna IA configurada. Al subir una captura se carga un ejemplo.
            Tocá acá para <b>configurar tus API keys</b>.
          </p>
        </button>
      ) : (
        <button onClick={onSettings} className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 dark:bg-brand/20 dark:text-brand-200">
          <Sparkle size={14} />IA: {providerText} · cambiar
        </button>
      )}

      <button onClick={onNew}
        className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-brand-500 py-4 text-lg font-semibold text-white shadow-lg shadow-brand/30 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/40">
        <Plus size={22} />Nueva actividad
      </button>

      <h2 className="mb-3 mt-7 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-400">
        <FileText size={15} />Mis actividades
        {!loading && items.length > 0 && <span className="ml-auto font-normal normal-case tracking-normal text-slate-400">{filtered.length}{filtered.length !== items.length ? ` / ${items.length}` : ''}</span>}
      </h2>

      {share && <ShareApp onClose={() => setShare(false)} />}

      {/* Buscador + filtro por materia (solo cuando hay suficientes actividades) */}
      {!loading && showControls && (
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar actividad…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-[15px] outline-none transition-colors focus:border-brand dark:border-slate-700 dark:bg-slate-900" />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda"
                className="tap absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
            )}
          </div>
          {subjects.length > 1 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Chip active={subject === null} onClick={() => setSubject(null)}>Todas</Chip>
              {subjects.map((s) => <Chip key={s} active={subject === s} onClick={() => setSubject(s)}>{s}</Chip>)}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-2.5" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
              <div className="skeleton h-14 w-14 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center text-slate-400">
          <Sparkles size={44} className="opacity-40" />
          <p>Todavía no tenés actividades.<br />Subí una captura para empezar ✨</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 text-center text-slate-400">
          <Search size={38} className="opacity-40" />
          <p>Sin resultados{query ? <> para "<b>{query}</b>"</> : ''}{subject ? <> en <b>{subject}</b></> : ''}.</p>
          <button onClick={() => { setQuery(''); setSubject(null); }} className="text-sm font-medium text-brand">Limpiar filtros</button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((it, i) => (
            <div key={it.id} style={{ animationDelay: `${Math.min(i * 40, 300)}ms`, animationFillMode: 'backwards' }}
              className="flex animate-slide-in items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-soft dark:bg-slate-900 dark:ring-slate-800">
              <button onClick={() => onOpen(it.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                {it.thumb ? (
                  <img src={it.thumb} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
                ) : (
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand dark:bg-brand/20"><FileText size={22} /></span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{it.title}</span>
                  <span className="block text-xs text-slate-500">
                    {it.subject ? it.subject + ' · ' : ''}{new Date(it.updatedAt).toLocaleDateString('es-AR')}
                  </span>
                </span>
              </button>
              <button onClick={() => remove(it.id)} aria-label="Eliminar"
                className="tap grid h-9 w-9 place-items-center rounded-full text-slate-300 hover:text-red-500">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick}
      className={`tap shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-brand text-white shadow-sm shadow-brand/25' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
      }`}>
      {children}
    </button>
  );
}
