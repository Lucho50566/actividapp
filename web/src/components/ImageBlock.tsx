import { useEffect, useState } from 'react';
import { ImageIcon, Search } from 'lucide-react';
import type { Block } from '@actividapp/shared';

type ImageBlockData = Extract<Block, { type: 'image' }>;

/** Muestra una figura de la actividad recortada de la captura original.
 *  Si no hay box válido o falla, ofrece abrir la captura completa. */
export function ImageBlock({ block, image, onOpenFull }: {
  block: ImageBlockData; image?: string; onOpenFull: () => void;
}) {
  const [crop, setCrop] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const box = block.box;

  useEffect(() => {
    if (!image || !box) { setFailed(true); return; }
    let ok = true;
    const img = new Image();
    img.onload = () => {
      if (!ok) return;
      try {
        const sx = box.x * img.width, sy = box.y * img.height;
        const sw = box.w * img.width, sh = box.h * img.height;
        if (sw < 8 || sh < 8) { setFailed(true); return; }
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(sw);
        canvas.height = Math.round(sh);
        const ctx = canvas.getContext('2d');
        if (!ctx) { setFailed(true); return; }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        setCrop(canvas.toDataURL('image/jpeg', 0.9));
      } catch { setFailed(true); }
    };
    img.onerror = () => ok && setFailed(true);
    img.src = image;
    return () => { ok = false; };
  }, [image, box]);

  if (crop) {
    return (
      <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <button onClick={onOpenFull} className="group block w-full" title="Ampliar">
          <img src={crop} alt={block.caption ?? 'Figura'}
            className="max-h-72 w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]" />
        </button>
        <figcaption className="flex items-center justify-between px-3 py-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><ImageIcon size={13} />{block.caption ?? 'Figura'}</span>
          <button onClick={onOpenFull} className="inline-flex items-center gap-1 text-brand">
            <Search size={13} />ampliar
          </button>
        </figcaption>
      </figure>
    );
  }

  if (image && failed) {
    return (
      <button onClick={onOpenFull}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-left dark:border-slate-700 dark:bg-slate-900">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand dark:bg-brand/20"><ImageIcon size={20} /></span>
        <span className="text-sm">
          <b>{block.caption ?? 'Imagen de la actividad'}</b><br />
          <span className="text-slate-500">Tocá para ver la captura y hacer zoom</span>
        </span>
      </button>
    );
  }
  return null;
}
