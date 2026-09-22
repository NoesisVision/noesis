import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const backend = 'http://127.0.0.1:3001';

export default defineConfig({
  plugins: [react()],
  build: {
    // The service serves this directory; it links its assets absolutely
    // because the SPA answers on every client route, not only on `/`.
    outDir: 'dist',
    emptyOutDir: true,
    // Mermaid alone is ~5 MB across ~80 chunks it imports on demand, one per
    // diagram kind. Rollup keeps that shape, so a reader downloads the kinds
    // the document in front of them actually uses.
    chunkSizeWarningLimit: 1500,
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    proxy: {
      '/ui': backend,
      '/internal': backend,
    },
  },
});
