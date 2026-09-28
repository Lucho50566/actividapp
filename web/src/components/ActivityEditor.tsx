import { useState } from 'react';
import { ArrowLeft, Check, Trash2, ChevronUp, ChevronDown, Plus, X, GripVertical } from 'lucide-react';
import type { Activity, Block, Option } from '@actividapp/shared';

const rid = () => Math.random().toString(36).slice(2, 8);
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

const BLOCK_NAME: Record<Block['type'], string> = {
  heading: 'Título de sección', paragraph: 'Párrafo', fill_blank: 'Completar huecos', open: 'Respuesta abierta',
  multiple_choice: 'Opción múltiple', true_false: 'Verdadero / Falso', matching: 'Unir con flechas',
  image: 'Figura', word_bank: 'Banco de palabras',
};

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 dark:border-slate-700 dark:bg-slate-900';

/** Editor de una lista de opciones (con id estable, para no romper respuestas ya cargadas). */
function OptionList({ items, onChange, placeholder }: { items: Option[]; onChange: (v: Option[]) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      {items.map((o, i) => (
        <div key={o.id} className="flex items-center gap-2">
          <input value={o.text} placeholder={placeholder} className={field + ' !py-1.5 text-sm'}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Quitar"
            className="tap grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-300 hover:text-red-500"><X size={16} /></button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { id: rid(), text: '' }])}
        className="inline-flex items-center gap-1 text-sm font-medium text-brand"><Plus size={14} />Agregar</button>
    </div>
  );
}

function StringList({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      {items.map((w, i) => (
        <div key={i} className="flex items-center gap-2">
          <input value={w} placeholder={placeholder} className={field + ' !py-1.5 text-sm'}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Quitar"
            className="tap grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-300 hover:text-red-500"><X size={16} /></button>
        </div>
      ))}
      <button onClick={() => onChange([...items, ''])}
        className="inline-flex items-center gap-1 text-sm font-medium text-brand"><Plus size={14} />Agregar</button>
    </div>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</p>
);

export function ActivityEditor({ activity, onSave, onCancel }: {
  activity: Activity; onSave: (a: Activity) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Activity>(() => clone(activity));

  const setBlock = (i: number, patch: Record<string, unknown>) =>
    setDraft((d) => ({ ...d, blocks: d.blocks.map((b, j) => (j === i ? ({ ...b, ...patch } as Block) : b)) }));
  const removeBlock = (i: number) => setDraft((d) => ({ ...d, blocks: d.blocks.filter((_, j) => j !== i) }));
  const move = (i: number, dir: -1 | 1) => setDraft((d) => {
    const j = i + dir;
    if (j < 0 || j >= d.blocks.length) return d;
    const blocks = [...d.blocks];
    [blocks[i], blocks[j]] = [blocks[j]!, blocks[i]!];
    return { ...d, blocks };
  });

  // Limpieza al guardar: recorta textos y descarta opciones/palabras vacías.
  const save = () => {
    const blocks = draft.blocks.map((b) => {
      const nb = clone(b);
      if ('prompt' in nb && typeof nb.prompt === 'string') nb.prompt = nb.prompt.trim();
      if (nb.type === 'multiple_choice') nb.options = nb.options.filter((o) => o.text.trim());
      if (nb.type === 'true_false') nb.statements = nb.statements.filter((s) => s.text.trim());
      if (nb.type === 'matching') { nb.left = nb.left.filter((o) => o.text.trim()); nb.right = nb.right.filter((o) => o.text.trim()); }
      if (nb.type === 'word_bank') nb.words = nb.words.map((w) => w.trim()).filter(Boolean);
      return nb;
    });
    onSave({ ...draft, title: draft.title.trim() || 'Actividad', subject: draft.subject?.trim() || undefined, blocks });
  };

  const editor = (b: Block, i: number) => {
    switch (b.type) {
      case 'heading':
      case 'paragraph':
        return <textarea value={b.text} rows={2} className={field} onChange={(e) => setBlock(i, { text: e.target.value })} />;
      case 'fill_blank':
        return (<>
          <textarea value={b.prompt} rows={3} className={field} onChange={(e) => setBlock(i, { prompt: e.target.value })} />
          <p className="mt-1 text-xs text-slate-400">Usá <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">____</code> (4+ guiones bajos) por cada hueco a completar.</p>
        </>);
      case 'open':
        return (<>
          <textarea value={b.prompt} rows={2} className={field} onChange={(e) => setBlock(i, { prompt: e.target.value })} />
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-slate-500">Renglones:</span>
            <input type="number" min={1} max={20} value={b.lines ?? 3} className={field + ' !w-20 !py-1'}
              onChange={(e) => setBlock(i, { lines: Math.max(1, Math.min(20, Number(e.target.value) || 3)) })} />
          </div>
        </>);
      case 'multiple_choice':
        return (<>
          <Label>Consigna</Label>
          <textarea value={b.prompt} rows={2} className={field} onChange={(e) => setBlock(i, { prompt: e.target.value })} />
          <label className="my-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!b.multiple} onChange={(e) => setBlock(i, { multiple: e.target.checked })} className="h-4 w-4 accent-brand" />
            Permite varias respuestas
          </label>
          <Label>Opciones</Label>
          <OptionList items={b.options} placeholder="Texto de la opción" onChange={(options) => setBlock(i, { options })} />
        </>);
      case 'true_false':
        return (<>
          <Label>Consigna (opcional)</Label>
          <input value={b.prompt ?? ''} className={field} placeholder="Ej: Indicá si es verdadero o falso" onChange={(e) => setBlock(i, { prompt: e.target.value })} />
          <Label>Afirmaciones</Label>
          <OptionList items={b.statements} placeholder="Afirmación" onChange={(statements) => setBlock(i, { statements })} />
        </>);
      case 'matching':
        return (<>
          <Label>Consigna (opcional)</Label>
          <input value={b.prompt ?? ''} className={field} placeholder="Ej: Uní cada uno con su par" onChange={(e) => setBlock(i, { prompt: e.target.value })} />
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div><Label>Columna izquierda</Label><OptionList items={b.left} placeholder="Elemento" onChange={(left) => setBlock(i, { left })} /></div>
            <div><Label>Columna derecha</Label><OptionList items={b.right} placeholder="Par" onChange={(right) => setBlock(i, { right })} /></div>
          </div>
        </>);
      case 'word_bank':
        return (<>
          <Label>Título (opcional)</Label>
          <input value={b.title ?? ''} className={field} placeholder="Palabras para usar" onChange={(e) => setBlock(i, { title: e.target.value })} />
          <Label>Palabras</Label>
          <StringList items={b.words} placeholder="Palabra" onChange={(words) => setBlock(i, { words })} />
        </>);
      case 'image':
        return (<>
          <Label>Epígrafe</Label>
          <input value={b.caption ?? ''} className={field} placeholder="Descripción de la figura" onChange={(e) => setBlock(i, { caption: e.target.value })} />
          <p className="mt-1 text-xs text-slate-400">El recorte se toma de la captura original y no se edita acá. Si está mal, podés borrar este bloque.</p>
        </>);
    }
  };

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-28">
      <header className="sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-slate-200/70 bg-slate-50/85 px-4 py-3 backdrop-blur-lg dark:border-slate-800/70 dark:bg-slate-950/85">
        <button onClick={onCancel} aria-label="Cancelar" className="tap grid h-10 w-10 place-items-center rounded-full bg-slate-100 dark:bg-slate-800"><ArrowLeft size={20} /></button>
        <h1 className="flex-1 text-lg font-bold">Editar actividad</h1>
        <button onClick={save} className="tap flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/30 hover:bg-brand-700"><Check size={18} />Guardar</button>
      </header>

      <div className="mt-4 space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <div><Label>Título</Label><input value={draft.title} className={field} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} /></div>
        <div><Label>Materia</Label><input value={draft.subject ?? ''} className={field} placeholder="Ej: Matemática" onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} /></div>
      </div>

      <div className="mt-4 space-y-3">
        {draft.blocks.map((b, i) => (
          <section key={b.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
            <div className="mb-2 flex items-center gap-2">
              <GripVertical size={16} className="text-slate-300" />
              <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-brand">{BLOCK_NAME[b.type]}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir"
                className="tap grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"><ChevronUp size={18} /></button>
              <button onClick={() => move(i, 1)} disabled={i === draft.blocks.length - 1} aria-label="Bajar"
                className="tap grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"><ChevronDown size={18} /></button>
              <button onClick={() => removeBlock(i)} aria-label="Borrar bloque"
                className="tap grid h-8 w-8 place-items-center rounded-full text-slate-300 hover:text-red-500"><Trash2 size={17} /></button>
            </div>
            {editor(b, i)}
          </section>
        ))}
        {draft.blocks.length === 0 && (
          <p className="py-10 text-center text-slate-400">No quedan bloques. Cancelá o guardá una actividad vacía.</p>
        )}
      </div>
    </div>
  );
}
