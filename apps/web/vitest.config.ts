import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./src/test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    /**
     * Coverage scopée — on n'audite pas tout le repo (bruit énorme,
     * faux signal). Cible : la zone feed produit livrée pour
     * CHA-225 (lib/products/feed/** + ProductFeedSection*.tsx + le
     * builder reviews). Threshold 80 % statements/lines, 70 %
     * branches — les fallbacks défensifs (`?? DEFAULT_…`) sont
     * difficiles à atteindre sans gymnastique de mock.
     *
     * Cf. rapport CHA-225 §5.5.3 — décision de garder le coverage en
     * opt-in (script `pnpm test:coverage`) plutôt que dans la run
     * standard, parce que l'instrumentation v8 ralentit la suite de
     * ~2× et n'aide pas le développeur quotidien.
     */
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: [
        'src/lib/products/feed/**/*.{ts,tsx}',
        'src/lib/products/reviews.ts',
        'src/components/sections/ProductFeedSection*.tsx',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/__snapshots__/**',
        // Les types-only files n'ont rien à couvrir.
        'src/lib/products/feed/types.ts',
        // Barrel d'index : que des re-exports.
        'src/lib/products/feed/index.ts',
        // RSC wrapper : couvert par les e2e Playwright (cf.
        // `e2e/product-feed-cart.spec.ts`), pas instrumentable
        // proprement par vitest qui ne sait pas exécuter
        // Server Components.
        'src/components/sections/ProductFeedSectionBound.tsx',
      ],
      thresholds: {
        statements: 80,
        lines: 80,
        functions: 80,
        // Branches plus tolérant : les guards `?? DEFAULT_…`,
        // les feature flags et les early returns créent des
        // branches difficiles à exercer sans mock lourd. Le
        // signal métier reste sur statements/lines.
        branches: 70,
      },
    },
  },
});
