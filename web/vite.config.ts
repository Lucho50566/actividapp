import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Actividapp — Resolvé actividades',
        short_name: 'Actividapp',
        description: 'Convertí capturas de actividades en ejercicios interactivos y guardá el trabajo en PDF.',
        id: '/',
        scope: '/',
        theme_color: '#7c3aed',
        background_color: '#ffffff',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        lang: 'es',
        dir: 'ltr',
        categories: ['education', 'productivity'],
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Las libs pesadas del PDF (jspdf/html2canvas/dompurify) solo se necesitan
        // al exportar: se excluyen del precache y se cachean on-demand tras el 1er uso.
        globIgnores: ['**/jspdf*.js', '**/html2canvas*.js', '**/purify*.js', '**/index.es*.js'],
        runtimeCaching: [{
          urlPattern: ({ url }) => /(jspdf|html2canvas|purify|index\.es)/.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: 'pdf-libs', expiration: { maxEntries: 12 } },
        }],
      },
    }),
  ],
  build: {
    rollupOptions: {
      // Vendor de React en su propio chunk: cache de larga duración entre deploys.
      output: { manualChunks: { react: ['react', 'react-dom'] } },
    },
  },
  server: {
    host: true,
    port: 5273,
    proxy: { '/api': 'http://localhost:3100' },
  },
});
