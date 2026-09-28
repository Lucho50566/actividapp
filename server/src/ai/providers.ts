export interface VisionInput {
  base64: string;
  mimeType: string;
  prompt: string;
}

export interface ProviderCfg {
  apiKey: string;
  model: string;
  baseUrl?: string; // para proveedores personalizados
}

const trimBase = (u: string) => u.replace(/\/+$/, '');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch con reintentos para errores transitorios (429 y 5xx / fallas de red).
 * Google a veces devuelve 503 "high demand"; reintentar evita que el pedido falle.
 */
async function fetchRetry(url: string, init: RequestInit, tries = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, init);
      if ((res.status === 429 || res.status >= 500) && i < tries - 1) {
        await sleep(600 * (i + 1) + Math.floor(Math.random() * 400));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) { await sleep(600 * (i + 1)); continue; }
      throw e;
    }
  }
  throw lastErr ?? new Error('fetch failed');
}

/**
 * Modelos Gemini de respaldo. Google retira modelos y a veces devuelve 503
 * "high demand" en un modelo puntual; probamos los siguientes en orden.
 */
const GEMINI_FALLBACKS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
];

export async function callGemini({ base64, mimeType, prompt }: VisionInput, cfg: ProviderCfg): Promise<string> {
  const base = cfg.baseUrl ? trimBase(cfg.baseUrl) : 'https://generativelanguage.googleapis.com/v1beta';
  const parts: unknown[] = [{ text: prompt }];
  if (base64) parts.push({ inline_data: { mime_type: mimeType, data: base64 } });
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 8192 },
  });

  const models = [cfg.model, ...GEMINI_FALLBACKS].filter((m, i, a) => m && a.indexOf(m) === i);
  let lastErr: unknown;
  for (let i = 0; i < models.length; i++) {
    const url = `${base}/models/${models[i]}:generateContent?key=${cfg.apiKey}`;
    try {
      const res = await fetchRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      // Modelo retirado o saturado -> probamos el siguiente modelo de respaldo.
      if ((res.status === 404 || res.status === 503 || res.status === 429) && i < models.length - 1) {
        lastErr = new Error(`Gemini ${res.status} (${models[i]})`);
        continue;
      }
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!text) { lastErr = new Error(`Gemini ${models[i]}: respuesta vacía`); continue; }
      return text;
    } catch (e) {
      lastErr = e;
      if (i < models.length - 1) continue;
      throw e;
    }
  }
  throw lastErr ?? new Error('Gemini: ningún modelo disponible');
}

export async function callAnthropic({ base64, mimeType, prompt }: VisionInput, cfg: ProviderCfg): Promise<string> {
  const base = cfg.baseUrl ? trimBase(cfg.baseUrl) : 'https://api.anthropic.com/v1';
  const content: unknown[] = [{ type: 'text', text: prompt }];
  if (base64) content.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } });
  const res = await fetchRetry(`${base}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 8192,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json() as { content?: { text?: string }[] };
  return data.content?.[0]?.text ?? '';
}

export async function callOpenai({ base64, mimeType, prompt }: VisionInput, cfg: ProviderCfg): Promise<string> {
  const base = cfg.baseUrl ? trimBase(cfg.baseUrl) : 'https://api.openai.com/v1';
  const content: unknown[] = [{ type: 'text', text: prompt }];
  if (base64) content.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } });
  const res = await fetchRetry(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

export function callProvider(format: string, input: VisionInput, cfg: ProviderCfg): Promise<string> {
  if (format === 'gemini') return callGemini(input, cfg);
  if (format === 'anthropic') return callAnthropic(input, cfg);
  if (format === 'openai') return callOpenai(input, cfg);
  throw new Error(`Formato de proveedor desconocido: ${format}`);
}
