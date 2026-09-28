import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FileDown, Check, Image as ImageIcon, Flag, RotateCcw, Share2, Sparkles, Loader2 } from 'lucide-react';
import type { Answers, Block } from '@actividapp/shared';
import type { StoredActivity } from '../lib/db';
import { saveAnswers } from '../lib/db';
import { exportActivityPdf } from '../lib/pdf';
import { usePrefs } from '../lib/prefs';
import { api, type GradeResult, type GradeItem } from '../lib/api';
import { normWord, escapeRe } from '../lib/text';
import { FillBlank, OpenAnswer, MultipleChoice, TrueFalse } from './Blocks';
import { Matching } from './Matching';
import { ImageBlock } from './ImageBlock';
import { CaptureViewer } from './CaptureViewer';
import { WordBank } from './WordBank';

const FLAGS_KEY = '__flags';
const INTERACTIVE: Block['type'][] = ['fill_blank', 'open', 'multiple_choice', 'true_false', 'matching'];

const EXERCISE_LABEL: Partial<Record<Block['type'], string>> = {
  fill_blank: 'Completar',
  multiple_choice: 'Opción múltiple',
  true_false: 'Verdadero o falso',
  matching: 'Unir con flechas',
  open: 'Respuesta abierta',
};

function isAnswered(block: Block, ans: unknown): boolean {
  switch (block.type) {
    case 'fill_blank': return Array.isArray(ans) && (ans as string[]).some((x) => x?.trim());
    case 'open': return typeof ans === 'string' && ans.trim().length > 0;
    case 'multiple_choice': return Array.isArray(ans) && ans.length > 0;
    case 'true_false': return !!ans && Object.values(ans as Record<string, string>).some((v) => v);
    case 'matching': return !!ans && Object.keys(ans as Record<string, string>).length > 0;
    default: return false;
  }
}

export function ActivityView({ stored, onBack }: { stored: StoredActivity; onBack: () => void }) {
  const { activity, image } = stored;
  const prefs = usePrefs();
  const [answers, setAnswers] = useState<Answers>(stored.answers ?? {});
  const [saved, setSaved] = useState(true);
  const [viewer, setViewer] = useState(false);
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [gradeError, setGradeError] = useState('');
  const timer = useRef<number | null>(null);
  const blockRefs = useRef<Map<string, HTMLElement>>(new Map());
  const flagCursor = useRef(0);

  const flags = useMemo(() => new Set((answers[FLAGS_KEY] as string[]) ?? []), [answers]);

  const set = (id: string, value: unknown) => {
    setAnswers((p) => ({ ...p, [id]: value }));
    setSaved(false);
    if (id !== FLAGS_KEY) setGrade(null); // al editar, la corrección deja de ser válida
  };
  const toggleFlag = (id: string) => {
    const next = new Set(flags);
    if (next.has(id)) next.delete(id); else next.add(id);
    set(FLAGS_KEY, [...next]);
  };
  const resetAll = () => {
    if (!confirm('¿Borrar todas tus respuestas de esta actividad? No se puede deshacer.')) return;
    setAnswers({}); setSaved(false); setGrade(null);
  };

  useEffect(() => {
    if (saved) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => { await saveAnswers(activity.id, answers); setSaved(true); }, 500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [answers, saved, activity.id]);

  const { done, total } = useMemo(() => {
    const interactive = activity.blocks.filter((b) => INTERACTIVE.includes(b.type));
    return { done: interactive.filter((b) => isAnswered(b, answers[b.id])).length, total: interactive.length };
  }, [activity.blocks, answers]);
  const pct = total ? Math.round((done / total) * 100) : 0;

  // Palabras del banco que el alumno YA escribió en alguna respuesta → se tachan solas.
  const usedWords = useMemo(() => {
    const texts: string[] = [];
    for (const b of activity.blocks) {
      const a = answers[b.id];
      if (b.type === 'fill_blank' && Array.isArray(a)) texts.push(...(a as unknown[]).map((x) => String(x ?? '')));
      else if (b.type === 'open' && typeof a === 'string') texts.push(a);
    }
    const joined = ' ' + texts.map(normWord).join('  ') + ' ';
    const used = new Set<string>();
    for (const b of activity.blocks) {
      if (b.type !== 'word_bank') continue;
      for (const w of b.words) {
        const nw = normWord(w);
        if (!nw) continue;
        if (nw.includes(' ')) { if (joined.includes(nw)) used.add(nw); }
        else if (new RegExp(`(^|[^a-z0-9])${escapeRe(nw)}([^a-z0-9]|$)`).test(joined)) used.add(nw);
      }
    }
    return used;
  }, [activity.blocks, answers]);

  const gradeById = useMemo(() => new Map((grade?.results ?? []).map((r) => [r.id, r])), [grade]);

  const exNumbers = useMemo(() => {
    const m = new Map<string, number>();
    let n = 0;
    for (const b of activity.blocks) if (INTERACTIVE.includes(b.type)) m.set(b.id, ++n);
    return m;
  }, [activity.blocks]);

  const runGrade = async () => {
    setGrading(true); setGradeError('');
    try {
      const clean: Answers = { ...answers };
      delete (clean as Record<string, unknown>)[FLAGS_KEY];
      const r = await api.grade(activity, clean, image);
      setGrade(r);
    } catch (e) { setGradeError((e as Error).message); }
    finally { setGrading(false); }
  };

  const jumpToFlag = () => {
    const ids = activity.blocks.filter((b) => flags.has(b.id)).map((b) => b.id);
    if (ids.length === 0) return;
    const id = ids[flagCursor.current % ids.length]!;
    flagCursor.current++;
    blockRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="mx-auto min-h-dvh max-w-5xl">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-slate-50/80 backdrop-blur-lg dark:border-slate-800/70 dark:bg-slate-950/80">
        <div className="flex items-center gap-2 px-4 py-3">
          <button onClick={onBack} aria-label="Volver" className="tap grid h-10 w-10 place-items-center rounded-full bg-slate-100 dark:bg-slate-800"><ArrowLeft size={20} /></button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">{activity.title}</h1>
            <p className="text-xs text-slate-500">
              {activity.subject ? activity.subject + ' · ' : ''}{done}/{total} resueltas
              <span className={saved ? 'text-green-500' : 'text-amber-500'}> · {saved ? 'guardado ✓' : 'guardando…'}</span>
            </p>
          </div>
          <button onClick={resetAll} aria-label="Reiniciar respuestas" title="Reiniciar respuestas"
            className="tap grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800"><RotateCcw size={18} /></button>
          <button onClick={() => { void exportActivityPdf(activity, answers, image, { mode: 'share' }); }} aria-label="Compartir PDF" title="Compartir PDF"
            className="tap grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Share2 size={18} /></button>
          {image && (
            <button onClick={() => setViewer(true)} aria-label="Ver captura" title="Ver captura"
              className="tap grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 lg:hidden"><ImageIcon size={19} /></button>
          )}
          <button onClick={() => { void exportActivityPdf(activity, answers, image); }} aria-label="Guardar PDF" title="Guardar PDF"
            className="tap flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-brand-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/30 transition-all hover:shadow-md hover:shadow-brand/40"><FileDown size={18} /><span className="hidden xs:inline sm:inline">PDF</span></button>
        </div>
        {total > 0 && (
          <div className="h-1.5 bg-slate-200 dark:bg-slate-800">
            <div className="h-full rounded-r-full bg-gradient-to-r from-brand to-brand-500 transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
          </div>
        )}
      </header>

      <div className="lg:flex lg:items-start lg:gap-6 lg:px-4">
        <main className="space-y-5 px-4 py-5 pb-28 lg:flex-1 lg:px-0">
          {total > 0 && (
            <section className="rounded-2xl border border-brand/30 bg-brand-50/60 p-4 dark:border-brand/40 dark:bg-brand/10 animate-fade-in">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white"><Sparkles size={20} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Corregir con IA</p>
                  <p className="text-xs text-slate-500">Revisa tus respuestas y te da una devolución por ejercicio.</p>
                </div>
                <button onClick={runGrade} disabled={grading}
                  className="tap flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/30 disabled:opacity-60">
                  {grading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{grading ? 'Corrigiendo…' : 'Corregir'}
                </button>
              </div>
              {grade && (
                <div className="mt-3 rounded-xl bg-white/80 p-3 dark:bg-slate-900/50">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-brand">{grade.score.correct}<span className="text-base font-semibold text-slate-400">/{grade.score.total}</span></span>
                    <span className="text-sm text-slate-500">bien{grade.score.partial ? ` · ${grade.score.partial} a medias` : ''}</span>
                  </div>
                  {grade.summary && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{grade.summary}</p>}
                </div>
              )}
              {gradeError && <p className="mt-2 text-sm text-red-500">{gradeError}</p>}
            </section>
          )}

          {activity.blocks.map((b, i) => {
            if (b.type === 'image' && !prefs.showCrops) return null;
            const isEx = INTERACTIVE.includes(b.type);
            const flagged = flags.has(b.id);
            const exNo = exNumbers.get(b.id);
            return (
              <section key={b.id} ref={(el) => { if (el) blockRefs.current.set(b.id, el); }}
                className={`scroll-mt-24 animate-slide-in ${
                  isEx
                    ? `rounded-2xl border bg-white p-4 shadow-sm shadow-slate-200/60 dark:bg-slate-900 dark:shadow-none ${
                        flagged ? 'border-amber-300 ring-2 ring-amber-300/60' : 'border-slate-200/70 dark:border-slate-800'
                      }`
                    : ''
                }`}
                style={{ animationDelay: `${Math.min(i * 45, 400)}ms`, animationFillMode: 'backwards' }}>
                {isEx && (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-500 text-[13px] font-bold text-white shadow-sm shadow-brand/30">{exNo}</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{EXERCISE_LABEL[b.type]}</span>
                    <button onClick={() => toggleFlag(b.id)} aria-label="Marcar para revisar"
                      className={`tap ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        flagged ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}>
                      <Flag size={13} fill={flagged ? 'currentColor' : 'none'} />{flagged ? 'Para revisar' : 'Marcar'}
                    </button>
                  </div>
                )}
                {renderBlock(b, answers[b.id], (v) => set(b.id, v), image, () => setViewer(true), usedWords)}
                {gradeById.get(b.id) && <FeedbackBanner item={gradeById.get(b.id)!} />}
              </section>
            );
          })}
          {done === total && total > 0 && (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-green-50 py-4 font-medium text-green-600 dark:bg-green-900/20 animate-fade-in">
              <Check size={20} />¡Actividad completa! Podés guardar el PDF.
            </div>
          )}
        </main>

        {image && (
          <aside className="sticky top-20 hidden w-72 shrink-0 py-5 lg:block">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Captura original</p>
            <button onClick={() => setViewer(true)} title="Ampliar"
              className="group block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <img src={image} alt="Captura" className="max-h-[70vh] w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]" />
              <span className="flex items-center justify-center gap-1 border-t border-slate-100 py-2 text-xs font-medium text-brand dark:border-slate-800"><ImageIcon size={13} />Ampliar / zoom</span>
            </button>
          </aside>
        )}
      </div>

      {/* Chip flotante: ir a lo marcado para revisar */}
      {flags.size > 0 && (
        <button onClick={jumpToFlag}
          className="tap fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-lg animate-fade-in"
          style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
          <Flag size={16} fill="currentColor" />Revisar ({flags.size})
        </button>
      )}

      {viewer && image && <CaptureViewer src={image} onClose={() => setViewer(false)} />}
    </div>
  );
}

function renderBlock(b: Block, value: unknown, onChange: (v: unknown) => void, image: string | undefined, openViewer: () => void, usedWords?: Set<string>) {
  switch (b.type) {
    case 'heading': return (
      <h2 className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-brand">
        <span className="h-5 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-brand to-brand-500" />{b.text}
      </h2>
    );
    case 'paragraph': return <p className="text-[16px] leading-relaxed text-slate-600 dark:text-slate-300">{b.text}</p>;
    case 'word_bank': return <WordBank title={b.title} words={b.words} autoUsed={usedWords} />;
    case 'image': return <ImageBlock block={b} image={image} onOpenFull={openViewer} />;
    case 'fill_blank': return <FillBlank prompt={b.prompt} value={(value as string[]) ?? []} onChange={onChange} />;
    case 'open': return <OpenAnswer prompt={b.prompt} lines={b.lines} value={(value as string) ?? ''} onChange={onChange} />;
    case 'multiple_choice': return <MultipleChoice prompt={b.prompt} options={b.options} multiple={b.multiple} value={(value as string[]) ?? []} onChange={onChange} />;
    case 'true_false': return <TrueFalse prompt={b.prompt} statements={b.statements} value={(value as Record<string, string>) ?? {}} onChange={onChange} />;
    case 'matching': return <Matching prompt={b.prompt} left={b.left} right={b.right} value={(value as Record<string, string>) ?? {}} onChange={onChange} />;
  }
}

/** Cartel de corrección que aparece debajo de cada ejercicio evaluado. */
function FeedbackBanner({ item }: { item: GradeItem }) {
  const style: Record<GradeItem['status'], { label: string; cls: string }> = {
    correct: { label: '¡Correcto!', cls: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-900/20 dark:text-green-300' },
    partial: { label: 'Casi…', cls: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300' },
    incorrect: { label: 'Para revisar', cls: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300' },
    unanswered: { label: 'Sin responder', cls: 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400' },
  };
  const map: Record<GradeItem['status'], string> = { correct: '✅', partial: '⚠️', incorrect: '❌', unanswered: '➖' };
  const s = style[item.status];
  return (
    <div className={`mt-2 flex items-start gap-2 rounded-xl border p-3 text-sm animate-fade-in ${s.cls}`}>
      <span className="shrink-0">{map[item.status]}</span>
      <span><b>{s.label}</b>{item.feedback ? <> — {item.feedback}</> : null}</span>
    </div>
  );
}
