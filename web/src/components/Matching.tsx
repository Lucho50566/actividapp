import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Option } from '@actividapp/shared';

const COLORS = ['#7c3aed', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#8b5cf6', '#eab308', '#6366f1'];

interface Selected { side: 'left' | 'right'; id: string; }
interface Line { x1: number; y1: number; x2: number; y2: number; color: string; }
interface Drag { side: 'left' | 'right'; id: string; startX: number; startY: number; moved: boolean; }

export function Matching({ prompt, left, right, value, onChange }: {
  prompt?: string; left: Option[]; right: Option[];
  value: Record<string, string>; onChange: (v: Record<string, string>) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const [selected, setSelected] = useState<Selected | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [temp, setTemp] = useState<Line | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);

  const setRef = (id: string) => (el: HTMLButtonElement | null) => { refs.current.set(id, el); };
  const colorFor = (lid: string) => COLORS[Math.max(0, left.findIndex((l) => l.id === lid)) % COLORS.length]!;
  const rightConnectedBy = (rid: string) => Object.keys(value).find((k) => value[k] === rid);

  const anchor = useCallback((id: string, side: 'left' | 'right') => {
    const cont = containerRef.current, el = refs.current.get(id);
    if (!cont || !el) return null;
    const cr = cont.getBoundingClientRect(), b = el.getBoundingClientRect();
    return { x: (side === 'left' ? b.right : b.left) - cr.left, y: b.top + b.height / 2 - cr.top };
  }, []);

  const measure = useCallback(() => {
    const out: Line[] = [];
    for (const [lid, rid] of Object.entries(value)) {
      const a = anchor(lid, 'left'), b = anchor(rid, 'right');
      if (a && b) out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: colorFor(lid) });
    }
    setLines(out);
  }, [value, anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    measure();
    const cont = containerRef.current;
    const ro = new ResizeObserver(measure);
    if (cont) ro.observe(cont);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [measure]);

  const connect = (lid: string, rid: string) => {
    const next = { ...value };
    if (next[lid] === rid) delete next[lid];
    else { for (const k of Object.keys(next)) if (next[k] === rid) delete next[k]; next[lid] = rid; }
    onChange(next);
    setSelected(null);
  };

  const tap = (side: 'left' | 'right', id: string) => {
    if (!selected) { setSelected({ side, id }); return; }
    if (selected.side === side) { setSelected(selected.id === id ? null : { side, id }); return; }
    connect(side === 'left' ? id : selected.id, side === 'right' ? id : selected.id);
  };

  // ---- Arrastrar para unir ----
  const onDown = (side: 'left' | 'right', id: string) => (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { side, id, startX: e.clientX, startY: e.clientY, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) d.moved = true;
    if (!d.moved) return;
    const a = anchor(d.id, d.side);
    const cr = containerRef.current!.getBoundingClientRect();
    if (a) setTemp({ x1: a.x, y1: a.y, x2: e.clientX - cr.left, y2: e.clientY - cr.top, color: d.side === 'left' ? colorFor(d.id) : '#94a3b8' });
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-mid]') as HTMLElement | null;
    setHover(el && el.dataset.side !== d.side ? el.dataset.mid ?? null : null);
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null; setTemp(null); setHover(null);
    if (!d) return;
    if (!d.moved) { tap(d.side, d.id); return; }
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-mid]') as HTMLElement | null;
    if (el && el.dataset.side && el.dataset.side !== d.side && el.dataset.mid) {
      connect(d.side === 'left' ? d.id : el.dataset.mid, d.side === 'right' ? d.id : el.dataset.mid);
    }
  };

  const isSel = (side: 'left' | 'right', id: string) => selected?.side === side && selected.id === id;

  // Función de render (NO un componente definido dentro de otro): evita que cada
  // cambio de estado desmonte y remonte todas las celdas (perdería refs en pleno drag).
  const renderItem = (side: 'left' | 'right', o: Option) => {
    const connected = side === 'left' ? !!value[o.id] : !!rightConnectedBy(o.id);
    const color = side === 'left' ? (value[o.id] ? colorFor(o.id) : undefined) : (rightConnectedBy(o.id) ? colorFor(rightConnectedBy(o.id)!) : undefined);
    const hovered = hover === o.id;
    return (
      <button key={o.id} ref={setRef(o.id)} data-mid={o.id} data-side={side}
        onPointerDown={onDown(side, o.id)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={connected && color ? { borderColor: color } : undefined}
        className={`tap relative z-10 flex w-full touch-none items-center gap-2 rounded-xl border-2 bg-white p-3 text-[16px] transition-all duration-150 dark:bg-slate-900 ${side === 'left' ? 'justify-between' : ''} ${
          isSel(side, o.id) || hovered ? 'border-brand ring-2 ring-brand/40 shadow-soft' : connected ? 'shadow-soft' : 'border-slate-200 hover:border-brand/40 dark:border-slate-700'
        }`}>
        {side === 'right' && <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color ?? '#cbd5e1' }} />}
        <span className="min-w-0 flex-1 truncate text-left">{o.text}</span>
        {side === 'left' && <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color ?? '#cbd5e1' }} />}
      </button>
    );
  };

  return (
    <div>
      {prompt && <p className="mb-1 text-[17px] font-medium">{prompt}</p>}
      <p className="mb-3 text-sm text-slate-500">Arrastrá una celda hasta la otra (o tocá una de cada lado) para unirlas. Tocá de nuevo para separar.</p>
      <div ref={containerRef} className="relative">
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" style={{ zIndex: 5 }}>
          {lines.map((l, i) => {
            const dx = Math.abs(l.x2 - l.x1);
            const c1 = l.x1 + dx * 0.45, c2 = l.x2 - dx * 0.45;
            const d = `M ${l.x1} ${l.y1} C ${c1} ${l.y1}, ${c2} ${l.y2}, ${l.x2} ${l.y2}`;
            return (
              <g key={i} className="animate-fade-in">
                <path d={d} fill="none" stroke="white" strokeWidth={7} strokeLinecap="round" className="dark:stroke-slate-950" />
                <path d={d} fill="none" stroke={l.color} strokeWidth={3.5} strokeLinecap="round" />
                <circle cx={l.x1} cy={l.y1} r={5} fill={l.color} stroke="white" strokeWidth={1.5} />
                <circle cx={l.x2} cy={l.y2} r={5} fill={l.color} stroke="white" strokeWidth={1.5} />
              </g>
            );
          })}
          {temp && (
            <path d={`M ${temp.x1} ${temp.y1} L ${temp.x2} ${temp.y2}`} fill="none" stroke={temp.color} strokeWidth={3} strokeDasharray="6 5" strokeLinecap="round" />
          )}
        </svg>
        <div className="flex justify-between gap-10">
          <div className="flex-1 space-y-2.5">{left.map((o) => renderItem('left', o))}</div>
          <div className="flex-1 space-y-2.5">{right.map((o) => renderItem('right', o))}</div>
        </div>
      </div>
    </div>
  );
}
