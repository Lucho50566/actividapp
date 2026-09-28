import { type Activity, type Answers, type Block, BLANK_TOKEN } from '@actividapp/shared';

/* ============================================================================
 *  Exportador de PDF "gráfico": reproduce el look de la interfaz interactiva
 *  (tarjetas, chips, burbujas, badges V/F, unir-con-flechas, banco de palabras)
 *  con dibujo vectorial de jsPDF — nítido, liviano y con texto seleccionable.
 *  jsPDF se importa de forma diferida para no cargarlo en el arranque.
 * ========================================================================== */

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const BRAND: RGB = [124, 58, 237];
const BRAND_700: RGB = [109, 40, 217];
const BRAND_50: RGB = [245, 243, 255];
const PAGE_BG: RGB = [248, 250, 252];   // slate-50
const CARD_BG: RGB = [255, 255, 255];
const BORDER: RGB = [226, 232, 240];    // slate-200
const INK: RGB = [15, 23, 42];          // slate-900
const INK2: RGB = [51, 65, 85];         // slate-700
const SLATE500: RGB = [100, 116, 139];
const SLATE400: RGB = [148, 163, 184];
const SLATE300: RGB = [203, 213, 225];
const SLATE100: RGB = [241, 245, 249];
const BLUE: RGB = [37, 99, 235];
const BLUE_50: RGB = [239, 246, 255];
const GREEN: RGB = [34, 197, 94];
const RED: RGB = [239, 68, 68];
// Mismos colores que Matching.tsx (unir con flechas)
const MATCH: RGB[] = ['#7c3aed', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#8b5cf6', '#eab308', '#6366f1'].map(hex);

const INTERACTIVE: Block['type'][] = ['fill_blank', 'open', 'multiple_choice', 'true_false', 'matching'];
function isAnswered(b: Block, ans: unknown): boolean {
  switch (b.type) {
    case 'fill_blank': return Array.isArray(ans) && (ans as string[]).some((x) => x?.trim());
    case 'open': return typeof ans === 'string' && ans.trim().length > 0;
    case 'multiple_choice': return Array.isArray(ans) && ans.length > 0;
    case 'true_false': return !!ans && Object.values(ans as Record<string, string>).some((v) => v);
    case 'matching': return !!ans && Object.keys(ans as Record<string, string>).length > 0;
    default: return false;
  }
}

function imgSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res({ w: i.width, h: i.height });
    i.onerror = () => res({ w: 0, h: 0 });
    i.src = src;
  });
}

/** Recorta una región normalizada (0..1) de la captura, igual que ImageBlock. */
function cropBox(image: string, box: { x: number; y: number; w: number; h: number }): Promise<{ url: string; w: number; h: number } | null> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      try {
        const sw = box.w * img.width, sh = box.h * img.height;
        if (sw < 8 || sh < 8) return res(null);
        const c = document.createElement('canvas');
        c.width = Math.round(sw); c.height = Math.round(sh);
        const ctx = c.getContext('2d');
        if (!ctx) return res(null);
        ctx.drawImage(img, box.x * img.width, box.y * img.height, sw, sh, 0, 0, sw, sh);
        res({ url: c.toDataURL('image/jpeg', 0.9), w: c.width, h: c.height });
      } catch { res(null); }
    };
    img.onerror = () => res(null);
    img.src = image;
  });
}

export async function exportActivityPdf(activity: Activity, answers: Answers, image?: string, opts: { mode?: 'download' | 'share' } = {}): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const width = pageW - margin * 2;   // ancho de contenido / tarjeta
  const P = 15;                       // padding interno de tarjeta
  const GAP = 12;                     // separación entre tarjetas
  let y = margin;

  const LH = (s: number) => s * 1.32;
  const str = (v: unknown) => (v == null ? '' : String(v));
  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  const paintBg = () => { setFill(PAGE_BG); doc.rect(0, 0, pageW, pageH, 'F'); };
  const newPage = () => { doc.addPage(); paintBg(); y = margin; };
  const ensure = (h: number) => { if (y + h > pageH - margin) newPage(); };

  // --- texto envuelto (medir + dibujar) ---
  const wrap = (text: unknown, size: number, maxW: number, style: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', style); doc.setFontSize(size);
    const lines = doc.splitTextToSize(str(text), maxW) as string[];
    return { lines, h: lines.length * LH(size) };
  };
  const put = (lines: string[], x: number, yTop: number, size: number, color: RGB, style: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', style); doc.setFontSize(size); setText(color);
    const lh = LH(size); let base = yTop + size * 0.82;
    for (const ln of lines) { doc.text(ln, x, base); base += lh; }
  };

  // --- texto "rico" en línea (segmentos con color/estilo/subrayado), con wrap ---
  interface Seg { t: string; color: RGB; bold?: boolean; underline?: boolean }
  const richHeight = (segs: Seg[], size: number, maxW: number, x0: number) => layoutRich(segs, size, maxW, x0, 0, false);
  const layoutRich = (segs: Seg[], size: number, maxW: number, x0: number, yTop: number, draw: boolean): number => {
    const lh = LH(size);
    let x = x0, rows = 1;
    let base = yTop + size * 0.82;
    for (const seg of segs) {
      doc.setFont('helvetica', seg.bold ? 'bold' : 'normal'); doc.setFontSize(size);
      const tokens = seg.t.split(/(\s+)/);
      for (const tk of tokens) {
        if (tk === '') continue;
        const w = doc.getTextWidth(tk);
        if (tk.trim() !== '' && x + w > x0 + maxW) { x = x0; rows++; base += lh; }
        if (draw) {
          setText(seg.color);
          doc.text(tk, x, base);
          if (seg.underline && tk.trim() !== '') {
            setDraw(seg.color); doc.setLineWidth(1.2);
            doc.line(x, base + 2.2, x + w, base + 2.2);
          }
        }
        x += w;
      }
    }
    return rows * lh;
  };

  // --- tarjeta contenedora ---
  const card = (innerH: number, drawFn: (x: number, y: number, iw: number) => void) => {
    const H = innerH + 2 * P;
    ensure(H);
    setFill(CARD_BG); setDraw(BORDER); doc.setLineWidth(0.8);
    doc.roundedRect(margin, y, width, H, 12, 12, 'FD');
    drawFn(margin + P, y + P, width - 2 * P);
    y += H + GAP;
  };

  // dibuja un tilde (check) blanco dentro de una burbuja centrada en (cx,cy)
  const checkMark = (cx: number, cy: number) => {
    setDraw([255, 255, 255]); doc.setLineWidth(1.4);
    doc.setLineCap('round'); doc.setLineJoin('round');
    doc.line(cx - 3, cy + 0.3, cx - 0.8, cy + 2.6);
    doc.line(cx - 0.8, cy + 2.6, cx + 3.2, cy - 2.6);
    doc.setLineCap('butt');
  };

  // ===================== Cabecera =====================
  paintBg();
  put(['ACTIVIDAPP'], margin, y, 10, BRAND, 'bold'); y += LH(10) + 2;
  { const t = wrap(activity.title, 20, width, 'bold'); put(t.lines, margin, y, 20, INK, 'bold'); y += t.h + 2; }
  const meta = [activity.subject, new Date().toLocaleDateString('es-AR')].filter(Boolean).join('   ·   ');
  if (meta) { put([meta], margin, y, 10, SLATE500); y += LH(10) + 2; }

  // barra de progreso (done/total resueltas)
  const inter = activity.blocks.filter((b) => INTERACTIVE.includes(b.type));
  const done = inter.filter((b) => isAnswered(b, answers[b.id])).length;
  const total = inter.length;
  if (total > 0) {
    const pct = done / total;
    const barY = y + 6, barH = 7, barW = width;
    setFill(BORDER); doc.roundedRect(margin, barY, barW, barH, 3.5, 3.5, 'F');
    if (pct > 0) { setFill(BRAND); doc.roundedRect(margin, barY, Math.max(barH, barW * pct), barH, 3.5, 3.5, 'F'); }
    put([`${done}/${total} resueltas`], margin, barY + barH + 4, 9, SLATE500, 'bold');
    y = barY + barH + 4 + LH(9) + 2;
  }
  put(['Tus respuestas aparecen en color.'], margin, y, 9, BLUE, 'bold'); y += LH(9) + 8;

  // ===================== Pre-recorte de figuras =====================
  const crops = new Map<string, { url: string; w: number; h: number } | null>();
  if (image) {
    await Promise.all(
      activity.blocks.filter((b): b is Extract<Block, { type: 'image' }> => b.type === 'image' && !!b.box)
        .map(async (b) => { crops.set(b.id, await cropBox(image, b.box!)); }),
    );
  }

  // ===================== Bloques =====================
  for (const b of activity.blocks) {
    switch (b.type) {
      case 'heading': {
        y += 6;
        const t = wrap(b.text, 15, width - 12, 'bold');
        ensure(t.h + 4);
        setFill(BRAND); doc.roundedRect(margin, y + 1, 3.5, t.h - 2, 1.5, 1.5, 'F');
        put(t.lines, margin + 12, y, 15, BRAND, 'bold');
        y += t.h + 6; break;
      }

      case 'paragraph': {
        const t = wrap(b.text, 11.5, width, 'normal');
        ensure(t.h + 8); put(t.lines, margin, y, 11.5, INK2); y += t.h + 8; break;
      }

      case 'fill_blank': {
        const arr = (answers[b.id] as string[]) ?? [];
        const parts = b.prompt.split(BLANK_TOKEN);
        const segs: Seg[] = [];
        parts.forEach((part, i) => {
          if (part) segs.push({ t: part, color: INK });
          if (i < parts.length - 1) {
            const a = str(arr[i]).trim();
            if (a) segs.push({ t: ` ${a} `, color: BRAND, bold: true, underline: true });
            else segs.push({ t: '  ______  ', color: SLATE400, bold: true });
          }
        });
        const iw = width - 2 * P;
        const h = richHeight(segs, 12.5, iw, 0);
        card(h, (x, yy) => { layoutRich(segs, 12.5, iw, x, yy, true); });
        break;
      }

      case 'open': {
        const iw = width - 2 * P;
        const pt = wrap(b.prompt, 12.5, iw, 'bold');
        const ans = str(answers[b.id]).trim();
        if (ans) {
          const at = wrap(ans, 11, iw - 16, 'normal');
          const boxH = at.h + 16;
          card(pt.h + 8 + boxH, (x, yy) => {
            put(pt.lines, x, yy, 12.5, INK, 'bold');
            const by = yy + pt.h + 8;
            setFill(BLUE_50); doc.roundedRect(x, by, iw, boxH, 8, 8, 'F');
            put(at.lines, x + 8, by + 8, 11, BLUE);
          });
        } else {
          const n = Math.min(Math.max(b.lines ?? 3, 1), 8);
          const linesH = n * 22;
          card(pt.h + 10 + linesH, (x, yy) => {
            put(pt.lines, x, yy, 12.5, INK, 'bold');
            setDraw(SLATE300); doc.setLineWidth(0.8);
            let ly = yy + pt.h + 10 + 12;
            for (let i = 0; i < n; i++) { doc.line(x, ly, x + iw, ly); ly += 22; }
          });
        }
        break;
      }

      case 'multiple_choice': {
        const iw = width - 2 * P;
        const pt = wrap(b.prompt, 12.5, iw, 'bold');
        const sel = (answers[b.id] as string[]) ?? [];
        const rowTextW = iw - 34;
        const rows = b.options.map((o) => {
          const t = wrap(o.text, 11.5, rowTextW, 'normal');
          return { o, t, h: Math.max(24, t.h) + 14 };
        });
        const innerH = pt.h + 8 + rows.reduce((s, r) => s + r.h + 8, 0) - 8;
        card(innerH, (x, yy) => {
          put(pt.lines, x, yy, 12.5, INK, 'bold');
          let ry = yy + pt.h + 8;
          for (const { o, t, h } of rows) {
            const on = sel.includes(o.id);
            setFill(on ? BRAND_50 : CARD_BG); setDraw(on ? BRAND : BORDER); doc.setLineWidth(on ? 1.1 : 0.8);
            doc.roundedRect(x, ry, iw, h, 9, 9, 'FD');
            const cy = ry + h / 2, cx = x + 15;
            if (o.text && on) {
              setFill(BRAND); setDraw(BRAND);
              if (b.multiple) doc.roundedRect(cx - 7, cy - 7, 14, 14, 3.5, 3.5, 'F');
              else doc.circle(cx, cy, 7, 'F');
              checkMark(cx, cy);
            } else {
              setDraw(SLATE300); doc.setLineWidth(1.1);
              if (b.multiple) doc.roundedRect(cx - 7, cy - 7, 14, 14, 3.5, 3.5, 'D');
              else doc.circle(cx, cy, 7, 'D');
            }
            put(t.lines, x + 30, ry + (h - t.h) / 2, 11.5, on ? BRAND_700 : INK2, on ? 'bold' : 'normal');
            ry += h + 8;
          }
        });
        break;
      }

      case 'true_false': {
        const iw = width - 2 * P;
        const pt = b.prompt ? wrap(b.prompt, 12.5, iw, 'bold') : { lines: [], h: 0 };
        const map = (answers[b.id] as Record<string, string>) ?? {};
        const badgesW = 22 * 2 + 8 + 10;               // dos badges + gaps
        const stTextW = iw - 24 - badgesW;
        const rows = b.statements.map((s) => {
          const t = wrap(s.text, 11.5, stTextW, 'normal');
          return { s, t, h: Math.max(30, t.h) + 12 };
        });
        const innerH = pt.h + (pt.h ? 8 : 0) + rows.reduce((sum, r) => sum + r.h + 8, 0) - 8;
        card(innerH, (x, yy) => {
          if (pt.h) put(pt.lines, x, yy, 12.5, INK, 'bold');
          let ry = yy + pt.h + (pt.h ? 8 : 0);
          for (const { s, t, h } of rows) {
            setFill(CARD_BG); setDraw(BORDER); doc.setLineWidth(0.8);
            doc.roundedRect(x, ry, iw, h, 9, 9, 'FD');
            put(t.lines, x + 12, ry + (h - t.h) / 2, 11.5, INK2);
            const v = map[s.id];
            const badge = (bx: number, label: 'V' | 'F', active: boolean, col: RGB) => {
              const by = ry + (h - 22) / 2;
              if (active) { setFill(col); doc.roundedRect(bx, by, 22, 22, 5, 5, 'F'); }
              else { setFill(SLATE100); doc.roundedRect(bx, by, 22, 22, 5, 5, 'F'); }
              put([label], bx + 22 / 2 - doc.getTextWidth(label) / 2, by + 4, 12, active ? [255, 255, 255] : SLATE500, 'bold');
            };
            const fx = x + iw - 22 - 10, vx = fx - 22 - 8;
            badge(vx, 'V', v === 'true', GREEN);
            badge(fx, 'F', v === 'false', RED);
            ry += h + 8;
          }
        });
        break;
      }

      case 'matching': {
        const iw = width - 2 * P;
        const pt = b.prompt ? wrap(b.prompt, 12.5, iw, 'bold') : { lines: [], h: 0 };
        const map = (answers[b.id] as Record<string, string>) ?? {};
        const colGap = 46, colW = (iw - colGap) / 2, cellTextW = colW - 26;
        const colorFor = (lid: string) => MATCH[Math.max(0, b.left.findIndex((l) => l.id === lid)) % MATCH.length]!;
        const rightBy = (rid: string) => Object.keys(map).find((k) => map[k] === rid);

        const build = (opts: { id: string; text: string }[]) => {
          const cells: { id: string; text: string; lines: string[]; h: number; top: number; mid: number }[] = [];
          let cy = 0;
          for (const o of opts) {
            const t = wrap(o.text, 11.5, cellTextW, 'normal');
            const h = Math.max(28, t.h) + 14;
            cells.push({ id: o.id, text: o.text, lines: t.lines, h, top: cy, mid: cy + h / 2 });
            cy += h + 10;
          }
          return { cells, total: cy - 10 };
        };
        const L = build(b.left), R = build(b.right);
        const colsH = Math.max(L.total, R.total);
        const innerH = pt.h + (pt.h ? 8 : 0) + colsH;

        card(innerH, (x, yy) => {
          if (pt.h) put(pt.lines, x, yy, 12.5, INK, 'bold');
          const top = yy + pt.h + (pt.h ? 8 : 0);
          const lx = x, rx = x + colW + colGap;
          const drawCell = (c: typeof L.cells[number], cx: number, side: 'left' | 'right', col?: RGB) => {
            const cy0 = top + c.top;
            setFill(CARD_BG); setDraw(col ?? BORDER); doc.setLineWidth(col ? 1.4 : 1);
            doc.roundedRect(cx, cy0, colW, c.h, 9, 9, 'FD');
            const dotC = col ?? SLATE300;
            setFill(dotC);
            if (side === 'left') {
              put(c.lines, cx + 12, cy0 + (c.h - c.lines.length * LH(11.5)) / 2, 11.5, INK2);
              doc.circle(cx + colW - 10, cy0 + c.h / 2, 3.6, 'F');
            } else {
              doc.circle(cx + 10, cy0 + c.h / 2, 3.6, 'F');
              put(c.lines, cx + 22, cy0 + (c.h - c.lines.length * LH(11.5)) / 2, 11.5, INK2);
            }
          };
          L.cells.forEach((c) => drawCell(c, lx, 'left', map[c.id] ? colorFor(c.id) : undefined));
          R.cells.forEach((c) => drawCell(c, rx, 'right', rightBy(c.id) ? colorFor(rightBy(c.id)!) : undefined));

          // conectores curvos (Bézier) coloreados, como el SVG de la interfaz
          doc.setLineCap('round'); doc.setLineJoin('round');
          for (const [lid, rid] of Object.entries(map)) {
            const lc = L.cells.find((c) => c.id === lid), rc = R.cells.find((c) => c.id === rid);
            if (!lc || !rc) continue;
            const x1 = lx + colW, y1 = top + lc.mid, x2 = rx, y2 = top + rc.mid;
            const dx = Math.abs(x2 - x1), c1 = x1 + dx * 0.45, c2 = x2 - dx * 0.45;
            const pts: [number, number][] = [];
            for (let i = 0; i <= 18; i++) {
              const t = i / 18, u = 1 - t;
              const px = u * u * u * x1 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * x2;
              const py = u * u * u * y1 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y2;
              pts.push([px, py]);
            }
            const col = colorFor(lid);
            const stroke = (c: RGB, w: number) => {
              setDraw(c); doc.setLineWidth(w);
              for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1]![0], pts[i - 1]![1], pts[i]![0], pts[i]![1]);
            };
            stroke([255, 255, 255], 5);   // halo blanco (como en la UI)
            stroke(col, 3);
            setFill(col); setDraw([255, 255, 255]); doc.setLineWidth(1.2);
            doc.circle(x1, y1, 3.6, 'FD'); doc.circle(x2, y2, 3.6, 'FD');
          }
          doc.setLineCap('butt');
        });
        break;
      }

      case 'word_bank': {
        const iw = width - 2 * P;
        const title = b.title || 'Palabras para usar';
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5);
        const chipH = 24, chipGap = 7, lineGap = 8, padX = 11;
        // medir filas de chips
        let rows = 1, cx = 0;
        const chips = b.words.map((w) => {
          const cw = doc.getTextWidth(w) + padX * 2;
          if (cx + cw > iw && cx > 0) { rows++; cx = 0; }
          const pos = { w: cw };
          cx += cw + chipGap;
          return pos;
        });
        const titleH = LH(11);
        const chipsH = rows * chipH + (rows - 1) * lineGap;
        card(titleH + 8 + chipsH, (x, yy) => {
          put([title], x, yy, 11, BRAND, 'bold');
          let px = x, py = yy + titleH + 8;
          b.words.forEach((w, i) => {
            const cw = chips[i]!.w;
            if (px + cw > x + iw && px > x) { px = x; py += chipH + lineGap; }
            setFill(BRAND_50); setDraw(BRAND); doc.setLineWidth(0.7);
            doc.roundedRect(px, py, cw, chipH, chipH / 2, chipH / 2, 'FD');
            put([w], px + padX, py + 5, 11.5, BRAND_700, 'bold');
            px += cw + chipGap;
          });
        });
        break;
      }

      case 'image': {
        const iw = width - 2 * P;
        const crop = crops.get(b.id);
        const cap = b.caption || 'Figura';
        if (crop) {
          const scale = Math.min(iw / crop.w, 240 / crop.h, 1);
          const dw = crop.w * scale, dh = crop.h * scale;
          const capH = LH(9);
          card(dh + 8 + capH, (x, yy, cw) => {
            doc.addImage(crop.url, 'JPEG', x + (cw - dw) / 2, yy, dw, dh, undefined, 'FAST');
            put([cap], x, yy + dh + 8, 9, SLATE500);
          });
        } else {
          const t = wrap(cap, 11, iw - 40, 'bold');
          card(Math.max(28, t.h), (x, yy) => {
            setFill(BRAND_50); doc.roundedRect(x, yy, 28, 28, 7, 7, 'F');
            put(['▦'], x + 8, yy + 6, 12, BRAND, 'bold');
            put(t.lines, x + 38, yy + 2, 11, INK2, 'bold');
            put(['Ver la captura original al final del PDF.'], x + 38, yy + 2 + t.h, 9, SLATE500);
          });
        }
        break;
      }
    }
  }

  // ===================== Captura original (última página) =====================
  if (image) {
    try {
      const { w: iw, h: ih } = await imgSize(image);
      if (iw > 0 && ih > 0) {
        newPage();
        const t = wrap('Captura original', 15, width, 'bold');
        setFill(BRAND); doc.roundedRect(margin, y + 1, 3.5, t.h - 2, 1.5, 1.5, 'F');
        put(t.lines, margin + 12, y, 15, BRAND, 'bold');
        y += t.h + 10;
        const maxW = width, maxH = pageH - margin - y;
        const ratio = Math.min(maxW / iw, maxH / ih);
        doc.addImage(image, 'JPEG', margin, y, iw * ratio, ih * ratio, undefined, 'FAST');
      }
    } catch { /* si falla, se omite la captura */ }
  }

  // ===================== Números de página =====================
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); setText(SLATE400);
    doc.text(`${p} / ${pages}`, pageW / 2, pageH - 18, { align: 'center' });
  }

  const safe = activity.title.replace(/[^\w\d]+/g, '_').slice(0, 40) || 'actividad';
  const filename = `${safe}.pdf`;

  // Compartir por el sistema (WhatsApp, Drive, mail…) cuando el dispositivo lo
  // permite; si no, se descarga como siempre.
  if (opts.mode === 'share' && typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const blob = doc.output('blob');
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: activity.title });
        return;
      }
    } catch { /* cancelado o no soportado: se descarga */ }
  }
  doc.save(filename);
}
