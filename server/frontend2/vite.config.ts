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
      // The ui app calls the server's /ui surface and navigates to /auth for
      // sign-in; /api belongs to the local app and /internal to ops tooling.
      // Same-origin in dev and prod — no CORS.
      '/ui': 'http://localhost:3000',
      // Sign-in is a navigation, so it has to come back to *this* origin:
      // NOESIS_PUBLIC_URL in dev is the dev server, not the backend port.
      '/auth': 'http://localhost:3000',
      // The design-doc editor's Yjs WebSocket (decision 53) — same-origin in
      // dev too, so the session cookie rides the upgrade.
      '/collab': { target: 'http://localhost:3000', ws: true },
    },
  },
});

export default config;
