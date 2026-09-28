import { useRef, useState, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

const MIN = 1, MAX = 6;
const clamp = (v: number, a = MIN, b = MAX) => Math.max(a, Math.min(b, v));

/** Visor a pantalla completa de la captura, con zoom (rueda/botones/pinch) y arrastre. */
export function CaptureViewer({ src, onClose }: { src: string; onClose: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDist = useRef<number | null>(null);
  const dragging = useRef(false);

  const relCenter = (clientX: number, clientY: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 };
  };

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setScale((s) => {
      const ns = clamp(s * factor);
      setPos((p) => {
        if (ns === 1) return { x: 0, y: 0 };
        const k = ns / s;
        return { x: cx - k * (cx - p.x), y: cy - k * (cy - p.y) };
      });
      return ns;
    });
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    const c = relCenter(e.clientX, e.clientY);
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, c.x, c.y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) dragging.current = true;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (pinchDist.current != null) {
        const mid = relCenter((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
        zoomAt(dist / pinchDist.current, mid.x, mid.y);
      }
      pinchDist.current = dist;
    } else if (dragging.current && scale > 1) {
      setPos((p) => ({ x: p.x + (e.clientX - prev.x), y: p.y + (e.clientY - prev.y) }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = null;
    if (pointers.current.size === 0) dragging.current = false;
  };

  const reset = () => { setScale(1); setPos({ x: 0, y: 0 }); };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 animate-fade-in">
      <div className="flex items-center justify-between p-3 text-white">
        <span className="text-sm opacity-70">{Math.round(scale * 100)}%</span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => zoomAt(1 / 1.3, 0, 0)} aria-label="Alejar" className="tap grid h-11 w-11 place-items-center rounded-full bg-white/10"><ZoomOut size={20} /></button>
          <button onClick={reset} aria-label="Ajustar" className="tap grid h-11 w-11 place-items-center rounded-full bg-white/10"><Maximize2 size={18} /></button>
          <button onClick={() => zoomAt(1.3, 0, 0)} aria-label="Acercar" className="tap grid h-11 w-11 place-items-center rounded-full bg-white/10"><ZoomIn size={20} /></button>
          <button onClick={onClose} aria-label="Cerrar" className="tap ml-1 grid h-11 w-11 place-items-center rounded-full bg-white/20"><X size={22} /></button>
        </div>
      </div>
      <div
        ref={wrapRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onDoubleClick={(e) => { const c = relCenter(e.clientX, e.clientY); zoomAt(scale > 1 ? 1 / scale : 2, c.x, c.y); }}
        className="grid flex-1 touch-none place-items-center overflow-hidden"
        style={{ cursor: scale > 1 ? 'grab' : 'zoom-in' }}
      >
        <img
          src={src} alt="Captura"
          draggable={false}
          style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transition: dragging.current ? 'none' : 'transform .12s ease-out' }}
          className="max-h-full max-w-full select-none object-contain"
        />
      </div>
      <p className="pb-3 text-center text-xs text-white/50">Rueda o pellizcá para zoom · arrastrá para mover · doble clic para acercar</p>
    </div>
  );
}
