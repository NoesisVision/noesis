import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // The ui app only calls the server's /ui surface (see @repo/ui-contracts
      // routes); /api belongs to the local app and /internal to ops tooling.
      '/ui': 'http://localhost:3000',
    },
  },
});
