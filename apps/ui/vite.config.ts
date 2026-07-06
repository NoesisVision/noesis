import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

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
