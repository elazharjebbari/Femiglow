import { defineConfig, devices } from '@playwright/test';

/**
 * Config Playwright DÉDIÉE aux tests pixel offline (anti-doublon lead→Meta
 * Purchase). Volontairement séparée de `playwright.config.ts` :
 *  - pas de `webServer` ni de projet `setup` (login admin) → tourne sans serveur
 *    Next ni accès réseau (donc zéro appel réel à Meta) ;
 *  - `testDir` distinct (`./e2e-pixel`) → n'interfère pas avec la suite e2e.
 *
 * Lancer : `pnpm exec playwright test -c playwright.pixel.config.ts`
 */
export default defineConfig({
  testDir: './e2e-pixel',
  fullyParallel: true,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  projects: [{ name: 'pixel', use: { ...devices['Desktop Chrome'] } }],
});
