/**
 * Helpers d'authentification partagés entre les specs Playwright.
 *
 * Source de vérité unique pour :
 *  - les credentials admin (lus depuis l'env, fallback bootstrap),
 *  - le chemin du storageState généré par `global.setup.ts`,
 *  - la fonction `loginAdmin(page)` réutilisable par les specs qui
 *    n'utilisent pas le storageState (ex. `auth-login.spec.ts` qui
 *    teste explicitement le formulaire).
 *
 * Migration vers storageState :
 *  - Les nouveaux specs admin importent `ADMIN_STORAGE_PATH` ou
 *    utilisent directement le projet Playwright `chromium-admin`
 *    (storageState pré-rempli).
 *  - Les anciens specs continuent d'appeler `loginAdmin(page)` ;
 *    aucun breaking change.
 */
import { type Page } from '@playwright/test';
import path from 'node:path';

/**
 * Le compte admin local est bootstrappé au premier login depuis les
 * variables `ADMIN_BOOTSTRAP_*` du `.env`. Les CI peuvent override
 * via `ADMIN_TEST_EMAIL` / `ADMIN_TEST_PASSWORD`.
 */
export const ADMIN_EMAIL =
  process.env.ADMIN_TEST_EMAIL ??
  process.env.ADMIN_BOOTSTRAP_EMAIL ??
  'admin@femiglow.local';

export const ADMIN_PWD =
  process.env.ADMIN_TEST_PASSWORD ??
  process.env.ADMIN_BOOTSTRAP_PASSWORD ??
  'admin-test-pass';

/**
 * Chemin du storageState produit par `global.setup.ts`. Relatif au
 * repo root (apps/web). Ignoré par git (cf. `.gitignore`).
 */
export const ADMIN_STORAGE_PATH = path.join(
  process.cwd(),
  '.auth',
  'admin.json',
);

/**
 * Login interactif depuis le formulaire `/admin/login`.
 *
 * Utilisé par :
 *  - `global.setup.ts` (1 fois par run pour produire le storageState),
 *  - `auth-login.spec.ts` (test du formulaire lui-même),
 *  - les specs antérieurs au pattern storageState (compatibilité).
 *
 * Le `waitForURL` exige explicitement de quitter `/admin/login` : sans
 * ça, un échec d'authentification (ex : credentials invalides) laisse
 * la page sur `/admin/login`, ce qui matchait l'ancien regex
 * `/\/admin(\/|$)/` et donnait l'illusion d'un succès — avec un
 * storageState vide à la clé.
 */
export async function loginAdmin(page: Page): Promise<void> {
  // Pre-set consent to avoid the banner blocking the login button.
  await page.context().addCookies([
    { name: 'fg_consent', value: 'all', domain: '127.0.0.1', path: '/' },
  ]);
  await page.goto('/admin/login');
  await page.waitForLoadState('domcontentloaded');
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/mot de passe/i).fill(ADMIN_PWD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  // 30 s pour tolérer le compile-on-demand de Next dev (la 1re requête
  // /admin POST puis redirection peut prendre 10-20 s à froid). En prod
  // build ou CI warmé, la nav est < 1 s — ce plafond n'est qu'un safety
  // net.
  await page.waitForURL(
    (url) =>
      /\/admin(\/|$)/.test(url.pathname) &&
      !url.pathname.startsWith('/admin/login'),
    { timeout: 30_000 },
  );
}
