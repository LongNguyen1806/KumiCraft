// Vite config of the Studio (ADR-FE-02). In production the Local Backend serves `dist/` itself;
// in development the backend runs separately and Vite proxies `/api` to it.
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiPort = process.env.REACTCRAFT_API_PORT ?? '4310';

export default defineConfig({
  plugins: [react({ compiler: true }), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: `http://127.0.0.1:${apiPort}`, ws: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
