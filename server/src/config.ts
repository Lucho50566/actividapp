import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = resolve(__dirname, '..');
loadEnv({ path: resolve(SERVER_ROOT, '.env') });

export type Provider = 'gemini' | 'anthropic' | 'openai' | 'none';

export const config = {
  port: Number(process.env.PORT ?? 3100),
  host: process.env.HOST ?? '0.0.0.0',
  isProd: process.env.NODE_ENV === 'production',
  serverRoot: SERVER_ROOT,
  webDist: resolve(SERVER_ROOT, '..', 'web', 'dist'),
  provider: (process.env.AI_PROVIDER ?? 'gemini') as Provider,
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-3.7-flash',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-latest',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  },
};

/** Devuelve el proveedor efectivo: si no hay key, cae a 'none' (modo demo). */
export function effectiveProvider(): Provider {
  const p = config.provider;
  if (p === 'gemini' && config.gemini.apiKey) return 'gemini';
  if (p === 'anthropic' && config.anthropic.apiKey) return 'anthropic';
  if (p === 'openai' && config.openai.apiKey) return 'openai';
  return 'none';
}
