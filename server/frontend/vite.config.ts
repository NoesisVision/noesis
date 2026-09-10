import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    // Generates `routeTree.gen.ts` from `src/routes/**` and splits route
    // components out of the initial bundle. Must run before the React plugin.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  server: {
    port: 5173,
    proxy: {
      // The ui app calls the server's /ui surface; /api belongs to the local
      // app and /internal to ops tooling. Same-origin in dev and prod — no CORS.
      '/ui': 'http://localhost:3000',
    },
  },
});

export default config;
