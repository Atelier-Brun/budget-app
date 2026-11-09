import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import paquet from './package.json' with { type: 'json' };
import { pwa } from './plugin-pwa.ts';

// L'app est servie par GitHub Pages sous https://bndh25.github.io/budget-app/
// La démo (`vite build --mode demo`) est une compilation séparée sous /budget-app/demo/.
export default defineConfig(({ mode }) => {
  const demo = mode === 'demo';
  const base = demo ? '/budget-app/demo/' : '/budget-app/';
  return {
    base,
    plugins: [svelte(), pwa(demo, base)],
    define: {
      // Numéro de version affiché dans l'app (source unique : package.json)
      __APP_VERSION__: JSON.stringify(paquet.version),
      __DEMO__: JSON.stringify(demo),
    },
    build: {
      target: 'es2022',
      sourcemap: false,
      outDir: demo ? 'dist/demo' : 'dist',
    },
    test: {
      include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
      environment: 'node',
      coverage: {
        provider: 'v8',
        include: ['src/lib/**/*.ts', 'scripts/**/*.mjs'],
        exclude: ['src/lib/**/*.test.ts', 'scripts/generer-icones.mjs'],
        thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  };
});
