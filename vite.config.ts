import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// RNF1: aplicación web Mobile First instalable como PWA (sin app nativa).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'NeuroGym',
        short_name: 'NeuroGym',
        description: 'Gestión de gimnasios multisede: turnos, asistencia, pagos, rutinas y profesionales.',
        lang: 'es-AR',
        theme_color: '#123b29',
        background_color: '#f4f6ef',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      // RD14: no existe modo sin conexión; solo se cachean los recursos estáticos.
      workbox: { navigateFallbackDenylist: [/^\/api/], runtimeCaching: [] },
    }),
  ],
  server: { port: 5173 },
  test: { environment: 'jsdom', globals: true, setupFiles: ['tests/setup.ts'] },
});
