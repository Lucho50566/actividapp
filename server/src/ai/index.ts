import { nanoid } from 'nanoid';
import { blockSchema, countBlanks, splitNumberedItems, type Activity, type Block } from '@actividapp/shared';
import { INTERPRET_PROMPT } from './prompt.js';
import { callProvider, type VisionInput } from './providers.js';
import { demoActivity } from '../demo.js';
import { providerOrder, resolveProvider, getFallback, PROVIDER_LABELS, type ProviderOverride } from '../settings.js';
import { config } from '../config.js';

/** Modelo por defecto según el formato, para overrides que no traen modelo. */
function defaultModelFor(format: string): string {
  if (format === 'gemini') return config.gemini.model;
  if (format === 'anthropic') return config.anthropic.model;
  if (format === 'openai') return config.openai.model;
  return '';
}

function extractJson(text: string): unknown {
  let t = text.trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

function cleanBlocks(raw: unknown): Block[] {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { blocks?: unknown }).blocks)) return [];
  const out: Block[] = [];
  const seen = new Set<string>();
  for (const b of (raw as { blocks: unknown[] }).blocks) {
    if (!b || typeof b !== 'object') continue;
    const rec = b as Record<string, unknown>;
    if (!rec.id || seen.has(String(rec.id))) rec.id = nanoid(6);
    const parsed = blockSchema.safeParse(rec);
    if (parsed.success) { seen.add(parsed.data.id); out.push(parsed.data); }
  }
  return out;
}

/**
 * Si un bloque "completar" o "abierta" en realidad junta VARIOS ítems numerados
 * (1, 2, 3…), lo parte en un bloque por ítem, así cada punto se muestra aparte
 * y con su propia numeración en la app.
 */
function expandNumbered(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    if (b.type === 'fill_blank' || b.type === 'open') {
      const split = splitNumberedItems(b.prompt);
      if (split && split.items.length >= 2) {
        if (split.preamble) out.push({ type: 'paragraph', id: nanoid(6), text: split.preamble });
        for (const item of split.items) {
          if (b.type === 'fill_blank' && countBlanks(item) === 0) {
            // Ítem sin huecos (la IA se olvidó del "____"): lo hacemos respuesta abierta
            // para que igual se pueda contestar.
            out.push({ type: 'open', id: nanoid(6), prompt: item, lines: 1 });
          } else if (b.type === 'fill_blank') {
            out.push({ type: 'fill_blank', id: nanoid(6), prompt: item });
          } else {
            out.push({ type: 'open', id: nanoid(6), prompt: item, lines: b.lines });
          }
        }
        continue;
      }
    }
    out.push(b);
  }
  return out;
}

export interface InterpretResult {
  activity: Activity;
  provider: string;
  demo: boolean;
  attempts?: { provider: string; error: string }[];
}

const shorten = (s: string, n = 140) => (s.length > n ? s.slice(0, n) + '…' : s);

function buildActivity(raw: string): Activity {
  const json = extractJson(raw);
  const blocks = expandNumbered(cleanBlocks(json));
  if (blocks.length === 0) throw new Error('No se detectaron actividades en la imagen.');
  const meta = json as { title?: string; subject?: string };
  return {
    id: nanoid(12),
    title: (meta.title && String(meta.title)) || 'Actividad',
    subject: meta.subject ? String(meta.subject) : undefined,
    createdAt: Date.now(),
    blocks,
  };
}

export async function interpretImage(
  base64: string, mimeType: string,
  opts?: { preferred?: string; fallback?: boolean; override?: ProviderOverride },
): Promise<InterpretResult> {
  const input: VisionInput = { base64, mimeType, prompt: INTERPRET_PROMPT };
  const attempts: { provider: string; error: string }[] = [];

  // 1) Key provista por el cliente (por dispositivo), NUNCA se persiste en el server.
  const ov = opts?.override;
  if (ov?.apiKey) {
    const fmt = ov.format ?? 'gemini';
    try {
      const raw = await callProvider(fmt, input, { apiKey: ov.apiKey, model: ov.model || defaultModelFor(fmt), baseUrl: ov.baseUrl });
      return { activity: buildActivity(raw), provider: ov.id || fmt, demo: false, attempts: attempts.length ? attempts : undefined };
    } catch (e) {
      attempts.push({ provider: ov.id || fmt, error: shorten((e as Error).message ?? 'error') });
    }
  }

  // 2) Proveedores configurados en el server (opcional).
  let order = providerOrder(opts?.preferred);
  if (order.length === 0) {
    if (attempts.length) {
      const detail = attempts.map((a) => `${PROVIDER_LABELS[a.provider] ?? a.provider}: ${a.error}`).join(' | ');
      const err = new Error(`No se pudo interpretar la imagen. ${detail}`);
      (err as Error & { attempts?: unknown }).attempts = attempts;
      throw err;
    }
    return { activity: demoActivity(), provider: 'none', demo: true };
  }

  const useFallback = opts?.fallback ?? getFallback();
  if (!useFallback) order = order.slice(0, 1);

  for (const id of order) {
    const p = resolveProvider(id);
    if (!p) continue;
    try {
      const raw = await callProvider(p.format, input, { apiKey: p.apiKey, model: p.model, baseUrl: p.baseUrl });
      return { activity: buildActivity(raw), provider: id, demo: false, attempts: attempts.length ? attempts : undefined };
    } catch (e) {
      attempts.push({ provider: id, error: shorten((e as Error).message ?? 'error') });
    }
  }

  const detail = attempts.map((a) => `${PROVIDER_LABELS[a.provider] ?? a.provider}: ${a.error}`).join(' | ');
  const err = new Error(order.length > 1
    ? `Ningún proveedor pudo interpretar la imagen. ${detail}`
    : `No se pudo interpretar la imagen. ${detail}`);
  (err as Error & { attempts?: unknown }).attempts = attempts;
  throw err;
}
