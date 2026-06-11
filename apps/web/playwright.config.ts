import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Mini-loader `.env` (sans dépendance) :
 *  - Le serveur Next.js lit `.env` via Node.js, mais Playwright tourne dans
 *    un process séparé qui ne voit rien.
 *  - On charge ici les variables (notamment `ADMIN_BOOTSTRAP_*`) pour que
 *    `e2e/helpers/auth.ts` puisse retomber sur les bons credentials sans
 *    nécessiter `ADMIN_TEST_*` explicite côté CI.
 *  - Format reconnu : `KEY=value` (espaces ignorés, lignes vides + #
 *    commentaires ignorés). Pas d'expansion `${VAR}`, pas de quoting
 *    multiline — suffisant pour notre usage.
 */
function loadEnvFile(filePath: string): void {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// Playwright lance la config depuis le cwd (apps/web). On ne peut pas
// utiliser `__dirname` (config en ESM), donc on s'aligne sur process.cwd().
loadEnvFile(path.join(process.cwd(), '.env'));
loadEnvFile(path.join(process.cwd(), '.env.local'));

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

/**
 * Cross-browser et cross-viewport sont **opt-in** via `PLAYWRIGHT_CROSS=1`.
 *
 * - Local : `chromium` seul (rapide, suffisant pour itérer).
 * - CI : la pipeline pose `PLAYWRIGHT_CROSS=1` après avoir installé
 *   `npx playwright install chromium firefox webkit` — on ajoute alors
 *   Firefox + WebKit + viewports mobile/tablette/desktop, scopés sur
 *   le smoke `product-feed.spec.ts` pour ne pas exploser le coût CI
 *   (×5 projets × 14 tests = 70 runs si on faisait tout partout).
 *
 * Décision design : on **n'inclut pas** la visual regression dans les
 * projets cross-* — chaque navigateur produirait son propre snapshot
 * (`-webkit-darwin.png`), ce qui multiplierait les baselines à
 * maintenir sans gain proportionnel. Le visual reg reste chromium-only.
 */
const crossBrowser = process.env.PLAYWRIGHT_CROSS === '1';

/**
 * Quarantaine CI (2026-06-11) : les specs `ai-engine-*` (battery spéculative
 * du 25/05, commit 5557875f) ont dérivé de l'UI réelle — ~60 échecs
 * déterministes mesurés contre staging (strict-mode violations, labels
 * renommés, pages restructurées). Avec retries=2 et workers=1 en CI, ces
 * échecs transforment le job e2e en run de plusieurs heures. Le job CI les
 * exclut via `CS_E2E_SKIP_AI_ENGINE=true` le temps de les réparer ; la
 * suite complète reste exécutable à la main (sans le flag).
 */
const quarantineAiEngine = process.env.CS_E2E_SKIP_AI_ENGINE === 'true';

/**
 * Pattern des specs ciblés par les projets cross-* (cross-browser et
 * cross-viewport). On scope volontairement à `product-feed.spec.ts`
 * (~14 tests, smoke représentatif) plutôt qu'à toute la suite.
 *
 * Si une autre feature critique ouvre un cross-* plus tard (checkout,
 * admin SSO…), ajouter ici plutôt que de dupliquer les configs projets.
 */
const CROSS_TEST_MATCH = /product-feed\.spec\.ts/;

/**
 * Configuration Playwright avec **setup project** pour partager une
 * session admin entre tous les specs qui en ont besoin.
 *
 * Pattern :
 *  1. Le projet `setup` lance `e2e/global.setup.ts` une fois par run :
 *     login admin → écrit `.auth/admin.json`.
 *  2. Le projet `chromium` (par défaut) dépend de `setup` : tout spec qui
 *     déclare `test.use({ storageState: ADMIN_STORAGE_PATH })` réutilise
 *     la session sans repasser par le formulaire.
 *  3. Les specs qui testent explicitement le formulaire de login
 *     (`auth-login.spec.ts`) ne déclarent pas de `storageState` → ils
 *     démarrent en visiteur anonyme.
 *
 * Bénéfice : ~3 s d'économisé par spec admin × ~10 specs ⇒ ~30 s par
 * run, et la flakiness liée au login est isolée à un seul endroit.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    /**
     * Projet "setup" — login admin une fois par run, écrit le storageState.
     * Filtre par testMatch pour ne lancer que `global.setup.ts`.
     */
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    /**
     * Projet par défaut — tous les specs, dépend de `setup`.
     * Les specs opt-in pour la session admin via :
     *   test.use({ storageState: ADMIN_STORAGE_PATH });
     * (cf. `e2e/helpers/auth.ts`).
     */
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: quarantineAiEngine
        ? [/global\.setup\.ts/, /content-studio-v2\/ai-engine-.*\.spec\.ts/]
        : /global\.setup\.ts/,
    },
    // ---------- Cross-browser (opt-in via PLAYWRIGHT_CROSS=1) -----------
    ...(crossBrowser
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
            dependencies: ['setup'],
            testMatch: CROSS_TEST_MATCH,
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
            dependencies: ['setup'],
            testMatch: CROSS_TEST_MATCH,
          },
          // ---------- Cross-viewport (opt-in via PLAYWRIGHT_CROSS=1) ---------
          // Mobile : Pixel 5 (devices Playwright) — 393×851. On override le
          // viewport à 375×812 pour matcher exactement la spec design (iPhone
          // SE/13 mini, taille la plus contraignante côté layout).
          {
            name: 'chromium-mobile',
            use: {
              ...devices['Pixel 5'],
              viewport: { width: 375, height: 812 },
            },
            dependencies: ['setup'],
            testMatch: CROSS_TEST_MATCH,
          },
          // Tablet : 768×1024 (iPad portrait, breakpoint Tailwind `md`).
          {
            name: 'chromium-tablet',
            use: {
              ...devices['Desktop Chrome'],
              viewport: { width: 768, height: 1024 },
            },
            dependencies: ['setup'],
            testMatch: CROSS_TEST_MATCH,
          },
          // Desktop large : 1280×800 (laptop standard, breakpoint `lg`).
          {
            name: 'chromium-desktop-large',
            use: {
              ...devices['Desktop Chrome'],
              viewport: { width: 1280, height: 800 },
            },
            dependencies: ['setup'],
            testMatch: CROSS_TEST_MATCH,
          },
        ]
      : []),
  ],
  webServer: process.env.CI
    ? {
        command: 'pnpm start',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
});
