import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { config } from './config.js';
import { registerRoutes } from './routes.js';
import { getLocalIp, qrTerminal } from './net.js';
import { effectiveActive } from './settings.js';

async function main(): Promise<void> {
  const app = Fastify({ logger: false, bodyLimit: 25 * 1024 * 1024 });
  await app.register(cors, { origin: true });
  await registerRoutes(app);

  if (existsSync(config.webDist)) {
    await app.register(fastifyStatic, { root: config.webDist, prefix: '/' });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api')) return reply.code(404).send({ error: 'not found' });
      return reply.sendFile('index.html');
    });
  }

  await app.listen({ port: config.port, host: config.host });

  const ip = getLocalIp();
  const url = `http://${ip}:${config.port}`;
  const provider = effectiveActive();
  const qr = await qrTerminal(url);
  console.log('\n' + '─'.repeat(48));
  console.log('  📚  Actividapp está en línea');
  console.log('─'.repeat(48));
  console.log(`  URL local:  ${url}`);
  console.log(`  IA:         ${provider === 'none' ? '⚠️  modo demo (falta API key)' : '✅ ' + provider}`);
  console.log('\n  Escaneá este QR desde otro dispositivo:\n');
  console.log(qr);
  console.log('─'.repeat(48) + '\n');
}

main().catch((err) => {
  console.error('❌ Error al iniciar Actividapp:', err);
  process.exit(1);
});
