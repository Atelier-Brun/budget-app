import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import paquet from './package.json' with { type: 'json' };

// L'app est servie par GitHub Pages sous https://bndh25.github.io/budget-app/
export default defineConfig({
  base: '/budget-app/',
  plugins: [svelte()],
  // Numéro de version affiché dans l'app (source unique : package.json)
  define: {
    __APP_VERSION__: JSON.stringify(paquet.version),
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'scripts/**/*.mjs'],
      exclude: ['src/lib/**/*.test.ts'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
