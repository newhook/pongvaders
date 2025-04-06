import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d'],
  },
  resolve: {
    alias: {
      '@dimforge/rapier3d': resolve(__dirname, 'node_modules/@dimforge/rapier3d'),
    },
  },
});
