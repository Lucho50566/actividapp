import type { FastifyInstance } from 'fastify';
import { activitySchema } from '@actividapp/shared';
import { config } from './config.js';
import { getLocalIp, qrDataUrl } from './net.js';
import { interpretImage } from './ai/index.js';
import { gradeActivity } from './ai/grade.js';
import { getSettingsPublic, updateSettings, effectiveActive, anyConfigured, type SettingsPatch, type ProviderOverride } from './settings.js';

const VERSION = '0.1.0';

/** Acepta dataURL ("data:image/png;base64,....") o base64 crudo + mimeType. */
function parseImage(body: unknown): { base64: string; mimeType: string; provider?: string; fallback?: boolean } | null {
  const b = body as { image?: string; mimeType?: string; provider?: string; fallback?: boolean };
  if (!b?.image || typeof b.image !== 'string') return null;
  const fallback = typeof b.fallback === 'boolean' ? b.fallback : undefined;
  const m = b.image.match(/^data:([^;]+);base64,(.+)$/s);
  if (m) return { mimeType: m[1]!, base64: m[2]!, provider: b.provider, fallback };
  return { base64: b.image, mimeType: b.mimeType ?? 'image/jpeg', provider: b.provider, fallback };
}

/** Key/proveedor que manda el cliente para ESTE pedido (no se guarda). */
function parseOverride(body: unknown): ProviderOverride | undefined {
  const o = (body as { override?: ProviderOverride } | undefined)?.override;
  if (!o || typeof o !== 'object') return undefined;
  const fmt = o.format;
  const out: ProviderOverride = {
    id: typeof o.id === 'string' && o.id.trim() ? o.id.trim() : undefined,
    format: fmt === 'gemini' || fmt === 'anthropic' || fmt === 'openai' ? fmt : undefined,
    apiKey: typeof o.apiKey === 'string' && o.apiKey.trim() ? o.apiKey.trim() : undefined,
    model: typeof o.model === 'string' && o.model.trim() ? o.model.trim() : undefined,
    baseUrl: typeof o.baseUrl === 'string' && o.baseUrl.trim() ? o.baseUrl.trim() : undefined,
  };
  return out.apiKey ? out : undefined;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async () => ({ ok: true, version: VERSION, provider: effectiveActive() }));

  app.get('/api/info', async () => {
    const ip = getLocalIp();
    const url = `http://${ip}:${config.port}`;
    return {
      version: VERSION, ip, port: config.port, url,
      qr: await qrDataUrl(url),
      provider: effectiveActive(),
      demo: !anyConfigured(),
    };
  });

  // --- Código QR para compartir el acceso (usa la URL recibida o la IP local) ---
  app.get('/api/qr', async (req) => {
    const q = (req.query as { url?: string }).url;
    const url = typeof q === 'string' && q.trim() ? q.trim() : `http://${getLocalIp()}:${config.port}`;
    return { url, qr: await qrDataUrl(url) };
  });

  // --- Configuración de proveedores de IA ---
  app.get('/api/settings', async () => getSettingsPublic());

  app.patch('/api/settings', async (req, reply) => {
    const body = req.body as SettingsPatch;
    if (!body || typeof body !== 'object') return reply.code(400).send({ error: 'cuerpo inválido' });
    return updateSettings(body);
  });

  // --- Interpretar imagen ---
  app.post('/api/interpret', async (req, reply) => {
    const img = parseImage(req.body);
    if (!img) return reply.code(400).send({ error: 'Falta la imagen (campo "image").' });
    try {
      return await interpretImage(img.base64, img.mimeType, { preferred: img.provider, fallback: img.fallback, override: parseOverride(req.body) });
    } catch (err) {
      req.log?.error?.(err);
      return reply.code(422).send({
        error: (err as Error).message ?? 'Error al interpretar la imagen.',
        attempts: (err as Error & { attempts?: unknown }).attempts,
      });
    }
  });

  // --- Corregir con IA: evalúa las respuestas y devuelve feedback por ejercicio ---
  app.post('/api/grade', async (req, reply) => {
    const b = req.body as {
      activity?: unknown; answers?: unknown;
      provider?: string; fallback?: boolean; image?: string; mimeType?: string;
    } | undefined;

    const parsed = activitySchema.safeParse(b?.activity);
    if (!parsed.success) return reply.code(400).send({ error: 'Actividad inválida.' });

    const answers = (b?.answers && typeof b.answers === 'object') ? b.answers as Record<string, unknown> : {};
    let img: { base64?: string; mimeType?: string } = {};
    if (typeof b?.image === 'string' && b.image) {
      const p = parseImage({ image: b.image, mimeType: b.mimeType });
      if (p) img = { base64: p.base64, mimeType: p.mimeType };
    }

    try {
      return await gradeActivity(parsed.data, answers, { preferred: b?.provider, fallback: b?.fallback, override: parseOverride(b), ...img });
    } catch (err) {
      req.log?.error?.(err);
      return reply.code(422).send({ error: (err as Error).message ?? 'Error al corregir.' });
    }
  });
}
