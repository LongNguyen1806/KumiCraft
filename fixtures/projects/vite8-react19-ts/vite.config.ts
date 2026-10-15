import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig, type Plugin } from 'vite';

function fixturePlugin(): Plugin {
  return {
    name: 'fixture-plugin',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { name: 'fixture-plugin', content: 'installed' },
          injectTo: 'head',
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), react(), fixturePlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
