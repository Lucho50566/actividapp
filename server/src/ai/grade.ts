import type { Activity, Answers, Block } from '@actividapp/shared';
import { GRADING_PROMPT } from './prompt.js';
import { callProvider, type VisionInput } from './providers.js';
import { providerOrder, resolveProvider, getFallback, PROVIDER_LABELS, type ProviderOverride } from '../settings.js';
import { config } from '../config.js';

function defaultModelFor(format: string): string {
  if (format === 'gemini') return config.gemini.model;
  if (format === 'anthropic') return config.anthropic.model;
  if (format === 'openai') return config.openai.model;
  return '';
}

export type GradeStatus = 'correct' | 'partial' | 'incorrect' | 'unanswered';

export interface GradeItem {
  id: string;
  status: GradeStatus;
  feedback: string;
}

export interface GradeResult {
  results: GradeItem[];
  summary: string;
  score: { correct: number; partial: number; total: number };
  provider: string;
}

const INTERACTIVE: Block['type'][] = ['fill_blank', 'open', 'multiple_choice', 'true_false', 'matching'];
const STATUSES: GradeStatus[] = ['correct', 'partial', 'incorrect', 'unanswered'];

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

/** Describe un ejercicio y la respuesta del alumno en texto plano para el corrector. */
function describe(block: Block, ans: unknown): string {
  switch (block.type) {
    case 'fill_blank': {
      const arr = Array.isArray(ans) ? (ans as string[]) : [];
      const parts = block.prompt.split(/_{3,}/);
      let out = '';
      parts.forEach((p, i) => {
        out += p;
        if (i < parts.length - 1) out += ` [${(arr[i] ?? '').toString().trim() || '____'}] `;
      });
      return `Completar huecos: ${out}`;
    }
    case 'open': {
      const a = typeof ans === 'string' ? ans.trim() : '';
      return `Respuesta abierta: ${block.prompt}\n  Respuesta del alumno: ${a || '(sin responder)'}`;
    }
    case 'multiple_choice': {
      const sel = new Set(Array.isArray(ans) ? (ans as string[]) : []);
      const opts = block.options.map((o) => `${sel.has(o.id) ? '[X]' : '[ ]'} ${o.text}`).join('   ');
      return `Opción múltiple${block.multiple ? ' (puede haber varias)' : ''}: ${block.prompt}\n  Opciones: ${opts}`;
    }
    case 'true_false': {
      const m = (ans && typeof ans === 'object') ? (ans as Record<string, string>) : {};
      const st = block.statements
        .map((s) => `"${s.text}" → ${m[s.id] === 'true' ? 'V' : m[s.id] === 'false' ? 'F' : '(sin responder)'}`)
        .join('\n  ');
      return `Verdadero/Falso${block.prompt ? ` (${block.prompt})` : ''}:\n  ${st}`;
    }
    case 'matching': {
      const m = (ans && typeof ans === 'object') ? (ans as Record<string, string>) : {};
      const lt = new Map(block.left.map((l) => [l.id, l.text]));
      const rt = new Map(block.right.map((r) => [r.id, r.text]));
      const pairs = Object.entries(m).map(([l, r]) => `"${lt.get(l) ?? l}" → "${rt.get(r) ?? r}"`);
      return `Unir con flechas${block.prompt ? ` (${block.prompt})` : ''}:\n  ${pairs.length ? pairs.join('\n  ') : '(sin unir)'}`;
    }
    default: return '';
  }
}

function extractJson(text: string): unknown {
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = t.indexOf('{'); const end = t.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

const shorten = (s: string, n = 180) => (s.length > n ? s.slice(0, n) + '…' : s);

async function gradeWith(
  format: string, cfg: { apiKey: string; model: string; baseUrl?: string },
  input: VisionInput, items: Block[], answers: Answers, providerId: string,
): Promise<GradeResult> {
  const raw = await callProvider(format, input, cfg);
  const json = extractJson(raw) as { summary?: unknown; results?: unknown };
  const raw_map = new Map<string, { status: GradeStatus; feedback: string }>();
  if (Array.isArray(json.results)) {
    for (const r of json.results) {
      if (!r || typeof r !== 'object') continue;
      const rec = r as Record<string, unknown>;
      const rid = rec.id != null ? String(rec.id) : '';
      if (!rid) continue;
      const status = STATUSES.includes(rec.status as GradeStatus) ? (rec.status as GradeStatus) : 'incorrect';
      raw_map.set(rid, { status, feedback: typeof rec.feedback === 'string' ? rec.feedback.trim() : '' });
    }
  }
  const results: GradeItem[] = items.map((b) => {
    const got = raw_map.get(b.id);
    const status = got?.status ?? (isAnswered(b, answers[b.id]) ? 'incorrect' : 'unanswered');
    return { id: b.id, status, feedback: got?.feedback ?? '' };
  });
  const correct = results.filter((r) => r.status === 'correct').length;
  const partial = results.filter((r) => r.status === 'partial').length;
  return {
    results,
    summary: typeof json.summary === 'string' ? json.summary.trim() : '',
    score: { correct, partial, total: items.length },
    provider: providerId,
  };
}

export async function gradeActivity(
  activity: Activity, answers: Answers,
  opts?: { preferred?: string; fallback?: boolean; base64?: string; mimeType?: string; override?: ProviderOverride },
): Promise<GradeResult> {
  const items = activity.blocks.filter((b) => INTERACTIVE.includes(b.type));
  if (items.length === 0) throw new Error('Esta actividad no tiene ejercicios para corregir.');

  const body = items.map((b) => `### id: ${b.id}\n${describe(b, answers[b.id])}`).join('\n\n');
  const prompt = `${GRADING_PROMPT}\n\n--- ACTIVIDAD ---\nTítulo: ${activity.title}${activity.subject ? `\nMateria: ${activity.subject}` : ''}\n\n--- EJERCICIOS Y RESPUESTAS ---\n${body}`;
  const input: VisionInput = { base64: opts?.base64 ?? '', mimeType: opts?.mimeType ?? 'image/jpeg', prompt };
  const attempts: string[] = [];

  // 1) Key del cliente (por dispositivo), no se persiste.
  const ov = opts?.override;
  if (ov?.apiKey) {
    const fmt = ov.format ?? 'gemini';
    try {
      return await gradeWith(fmt, { apiKey: ov.apiKey, model: ov.model || defaultModelFor(fmt), baseUrl: ov.baseUrl }, input, items, answers, ov.id || fmt);
    } catch (e) {
      attempts.push(`${PROVIDER_LABELS[ov.id || fmt] ?? (ov.id || fmt)}: ${shorten((e as Error).message ?? 'error')}`);
    }
  }

  // 2) Proveedores configurados en el server (opcional).
  let order = providerOrder(opts?.preferred);
  if (order.length === 0) {
    if (attempts.length) throw new Error(`No se pudo corregir con IA. ${attempts.join(' | ')}`);
    throw new Error('No hay ninguna IA configurada. Configurá tu propia API key para poder corregir.');
  }
  const useFallback = opts?.fallback ?? getFallback();
  if (!useFallback) order = order.slice(0, 1);

  for (const id of order) {
    const p = resolveProvider(id);
    if (!p) continue;
    try {
      return await gradeWith(p.format, { apiKey: p.apiKey, model: p.model, baseUrl: p.baseUrl }, input, items, answers, id);
    } catch (e) {
      attempts.push(`${PROVIDER_LABELS[id] ?? id}: ${shorten((e as Error).message ?? 'error')}`);
    }
  }

  throw new Error(`No se pudo corregir con IA. ${attempts.join(' | ')}`);
}
