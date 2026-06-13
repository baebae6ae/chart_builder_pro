import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  // Asset base path. Cloudflare Pages (and local) serve from root ('/'), while
  // GitHub Pages serves from a repo subpath; the deploy workflow injects
  // BASE_PATH=/chart_builder_pro/ so both targets work from one config.
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // The heavy libraries below are dynamically imported (loaded on demand), so
    // their large chunk sizes don't affect first paint — raise the warn limit.
    chunkSizeWarningLimit: 1200,
    // Heavy, optional libraries are split into their own chunks so the initial
    // bundle stays small and these only load when a user actually exports/parses.
    rollupOptions: {
      output: {
        manualChunks: {
          xlsx: ['xlsx'],
          pptx: ['pptxgenjs'],
          echarts: ['echarts'],
        },
      },
    },
  },
});
