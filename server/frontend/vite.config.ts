import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      // The ui app calls the server's /ui surface (through the typed hc
      // client, see src/client.ts) and navigates to /auth for sign-in;
      // /api belongs to the local app and /internal to ops tooling.
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
