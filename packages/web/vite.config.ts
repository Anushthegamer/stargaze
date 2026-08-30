import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The core package ships TypeScript source rather than a build step: it is
// consumed only by this app and by the tests, and an alias keeps both honest
// without a compile pass in the middle.
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@stargaze/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
  server: {
    host: true, // reachable from a phone on the same network
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
