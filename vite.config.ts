import { defineConfig } from 'vite';

// DECISION: No vite-plugin-pwa. Hand-rolled service worker keeps the dependency
// surface small and the cache strategy auditable. The plugin adds ~500kb to
// node_modules for marginal value over a 40-line sw.js file.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/math/')) return 'math';
          if (id.includes('/src/ui/')) return 'ui';
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
  server: { port: 5173 },
});
