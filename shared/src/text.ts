/** Utilidades de texto compartidas entre el frontend y el backend. */

export interface NumberedSplit {
  preamble: string;
  items: string[];
}

/**
 * Detecta listas numeradas dentro de un texto ("1) …", "2. …", "3 - …", "4 …")
 * y las separa en ítems. Solo divide cuando encuentra una corrida ASCENDENTE que
 * arranca en 1 (1,2,3,…) con 2 o más ítems, para evitar falsos positivos.
 * Devuelve null si el texto no parece una lista numerada.
 */
export function splitNumberedItems(text: string): NumberedSplit | null {
  const re = /(?:^|\s)(\d{1,2})\s*[).\-–—:]?\s+/g;
  const marks: { num: number; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const lead = raw.length - raw.replace(/^\s+/, '').length;
    marks.push({ num: Number(m[1]), start: m.index + lead });
    if (marks.length > 80) break;
  }
  if (marks.length < 2) return null;

  // Corrida ascendente más larga que empieza en 1.
  let best: { num: number; start: number }[] = [];
  for (let i = 0; i < marks.length; i++) {
    const first = marks[i];
    if (!first || first.num !== 1) continue;
    const run = [first];
    for (let j = i + 1; j < marks.length; j++) {
      const cur = marks[j];
      const prev = run[run.length - 1];
      if (cur && prev && cur.num === prev.num + 1) run.push(cur);
      else break;
    }
    if (run.length > best.length) best = run;
  }
  if (best.length < 2) return null;

  const items: string[] = [];
  for (let k = 0; k < best.length; k++) {
    const cur = best[k];
    if (!cur) continue;
    const next = best[k + 1];
    items.push(text.slice(cur.start, next ? next.start : text.length).trim());
  }
  const first = best[0];
  return { preamble: first ? text.slice(0, first.start).trim() : '', items };
}
