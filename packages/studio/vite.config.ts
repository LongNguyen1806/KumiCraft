// Vite config of the Studio (ADR-FE-02). In production the Local Backend serves `dist/` itself;
// in development the backend runs separately and Vite proxies `/api` to it.
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiPort = process.env.REACTCRAFT_API_PORT ?? '4310';

export default defineConfig({
  // React Compiler (VG-13) through `oxc-transform-react`, the Rust port of the compiler.
  // Fallback if that port misbehaves: Meta's Babel compiler. `babel-plugin-react-compiler` is kept
  // installed for that; add `@rolldown/plugin-babel` and use `reactCompilerPreset()` from
  // `@vitejs/plugin-react` instead of `compiler: true`.
  plugins: [react({ compiler: true }), tailwindcss()],
  server: {
    host: '127.0.0.1',
    // Not 5173: that is the port a project's own dev server takes in the Canvas (R-RN-04).
    port: 4311,
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
