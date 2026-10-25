import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// One React for the app and react-router, which the tests link from the repo root.
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
});
