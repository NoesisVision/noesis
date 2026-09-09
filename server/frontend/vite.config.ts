import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart({
      // SPA mode: the build emits a static shell instead of a Start server,
      // so the Hono backend keeps serving the UI from UI_DIST_PATH (decision
      // 36) exactly as it served the previous SPA — no second server process.
      spa: {
        enabled: true,
        prerender: { outputPath: '/index.html' },
      },
    }),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  server: {
    proxy: {
      // The ui app calls the server's /ui surface; /api belongs to the local
      // app and /internal to ops tooling. Same-origin in dev and prod — no CORS.
      '/ui': 'http://localhost:3000',
    },
  },
});

export default config;
