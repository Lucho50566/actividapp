import { Check } from 'lucide-react';
import { countBlanks, splitNumberedItems } from '@actividapp/shared';

// ---- Completar huecos ----
export function FillBlank({ prompt, value, onChange }: {
  prompt: string; value: string[]; onChange: (v: string[]) => void;
}) {
  const set = (i: number, val: string) => {
    const next = [...value];
    next[i] = val;
    onChange(next);
  };

  // Si la consigna en realidad trae varios ítems numerados (1, 2, 3…), los
  // mostramos separados — cada uno en su propia línea, con su número.
  const split = splitNumberedItems(prompt);
  if (split && split.items.length >= 2) {
    let offset = 0;
    return (
      <div className="space-y-3.5">
        {split.preamble && <p className="text-[15px] leading-relaxed text-slate-500">{split.preamble}</p>}
        {split.items.map((item, idx) => {
          const start = offset;
          offset += countBlanks(item);
          return (
            <div key={idx} className="flex gap-2.5">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-brand-50 text-xs font-bold text-brand dark:bg-brand/20">{idx + 1}</span>
              <InlineBlanks text={item} value={value} set={set} start={start} />
            </div>
          );
        })}
      </div>
    );
  }

  return <InlineBlanks text={prompt} value={value} set={set} start={0} />;
}

function InlineBlanks({ text, value, set, start }: {
  text: string; value: string[]; set: (i: number, v: string) => void; start: number;
}) {
  const parts = text.split(/_{3,}/);
  return (
    <p className="flex-1 text-[17px] leading-relaxed">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <input
              value={value[start + i] ?? ''}
              onChange={(e) => set(start + i, e.target.value)}
              aria-label={`Hueco ${start + i + 1}`}
              className="mx-1 inline-block min-w-[80px] max-w-[60vw] border-b-2 border-brand bg-transparent px-1 text-center font-medium text-brand outline-none focus:border-brand-700"
            />
          )}
        </span>
      ))}
    </p>
  );
}

// ---- Respuesta abierta ----
export function OpenAnswer({ prompt, lines, value, onChange }: {
  prompt: string; lines?: number; value: string; onChange: (v: string) => void;
}) {
  const split = splitNumberedItems(prompt);
  const hasItems = !!split && split.items.length >= 2;
  return (
    <div>
      {hasItems && split ? (
        <div className="mb-2 space-y-1.5">
          {split.preamble && <p className="text-[15px] leading-relaxed text-slate-500">{split.preamble}</p>}
          {split.items.map((it, i) => (
            <p key={i} className="text-[17px] font-medium leading-relaxed">{it}</p>
          ))}
        </div>
      ) : (
        <p className="mb-2 text-[17px] font-medium">{prompt}</p>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={lines ?? 3}
        placeholder="Escribí tu respuesta…"
        className="answer-input resize-y leading-relaxed"
      />
    </div>
  );
}

// ---- Opción múltiple ----
export function MultipleChoice({ prompt, options, multiple, value, onChange }: {
  prompt: string; options: { id: string; text: string }[]; multiple?: boolean;
  value: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (multiple) onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
    else onChange(value.includes(id) ? [] : [id]);
  };
  return (
    <div>
      <p className="mb-2 text-[17px] font-medium">{prompt}</p>
      <div className="space-y-2">
        {options.map((o) => {
          const sel = value.includes(o.id);
          return (
            <button key={o.id} onClick={() => toggle(o.id)}
              className={`tap flex w-full items-center gap-3 rounded-xl border p-3 text-left text-[16px] transition-all duration-150 ${
                sel ? 'border-brand bg-brand-50 shadow-soft dark:bg-brand/20' : 'border-slate-200 bg-white hover:border-brand/40 dark:border-slate-700 dark:bg-slate-900'
              }`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center border-2 transition-all duration-150 ${multiple ? 'rounded-md' : 'rounded-full'} ${
                sel ? 'scale-105 border-brand bg-brand text-white' : 'border-slate-300 text-transparent dark:border-slate-600'
              }`}>
                <Check size={15} />
              </span>
              <span>{o.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Verdadero / Falso ----
export function TrueFalse({ prompt, statements, value, onChange }: {
  prompt?: string; statements: { id: string; text: string }[];
  value: Record<string, string>; onChange: (v: Record<string, string>) => void;
}) {
  const set = (sid: string, v: 'true' | 'false') => onChange({ ...value, [sid]: value[sid] === v ? '' : v });
  return (
    <div>
      {prompt && <p className="mb-2 text-[17px] font-medium">{prompt}</p>}
      <div className="space-y-2">
        {statements.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <span className="flex-1 text-[16px]">{s.text}</span>
            {(['true', 'false'] as const).map((v) => (
              <button key={v} onClick={() => set(s.id, v)}
                className={`tap grid h-10 w-10 place-items-center rounded-lg font-bold transition-all duration-150 ${
                  value[s.id] === v
                    ? v === 'true' ? 'scale-105 bg-green-500 text-white shadow-soft' : 'scale-105 bg-red-500 text-white shadow-soft'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                {v === 'true' ? 'V' : 'F'}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
