import { useState } from 'react';
import { BookMarked, Check } from 'lucide-react';
import { normWord } from '../lib/text';

/** Banco de palabras: se muestra destacado y separado del resto de la actividad.
 *  Las palabras que el alumno ya escribió en sus respuestas se tachan SOLAS
 *  (viene en `autoUsed`). Tocá una palabra para marcarla/desmarcarla a mano. */
export function WordBank({ title, words, autoUsed }: {
  title?: string; words: string[]; autoUsed?: Set<string>;
}) {
  const [manual, setManual] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setManual((s) => {
    const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n;
  });

  const usedWords = words.filter((w, i) => manual.has(i) || autoUsed?.has(normWord(w))).length;

  return (
    <div className="rounded-2xl border-2 border-brand/30 bg-brand-50/60 p-4 dark:border-brand/40 dark:bg-brand/10">
      <div className="mb-2.5 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-brand-700 dark:text-brand-200">
        <BookMarked size={15} />{title || 'Palabras para usar'}
        {usedWords > 0 && <span className="ml-auto font-medium normal-case tracking-normal text-brand-700/70 dark:text-brand-200/70">{usedWords}/{words.length} usadas</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {words.map((w, i) => {
          const used = manual.has(i) || !!autoUsed?.has(normWord(w));
          return (
            <button key={i} onClick={() => toggle(i)} aria-pressed={used}
              className={`tap inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[16px] font-semibold shadow-sm transition-all duration-150 ${
                used
                  ? 'border-slate-200 bg-slate-100 text-slate-400 line-through dark:border-slate-700 dark:bg-slate-800'
                  : 'border-brand/30 bg-white text-slate-800 hover:-translate-y-0.5 dark:bg-slate-900 dark:text-slate-100'
              }`}>
              {used && <Check size={14} className="no-underline" />}
              {w}
            </button>
          );
        })}
      </div>
    </div>
  );
}
