import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const backend = 'http://127.0.0.1:3001';

export default defineConfig({
  plugins: [react()],
  build: {
    /*
     * Browsers that have `light-dark()`. Below this, LightningCSS — vite's
     * default CSS minifier — rewrites every `light-dark(a, b)` into
     * `var(--lightningcss-light, a) var(--lightningcss-dark, b)` and never
     * emits the two toggle variables that shape depends on, so the whole
     * declaration is invalid and the colour is simply dropped. Kept native,
     * it also follows the theme toggle rather than the OS: Mantine sets
     * `color-scheme: var(--mantine-color-scheme)` from its own attribute,
     * and `light-dark()` reads exactly that.
     *
     * The page is served from loopback to the developer's own browser, so
     * this costs nothing.
     */
    cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5'],
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
