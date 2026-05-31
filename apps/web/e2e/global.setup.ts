/**
 * Playwright "setup project" — login admin une fois par run.
 *
 * Pattern officiel Playwright : un projet "setup" se lance avant les
 * autres projets, écrit un fichier de storageState, et tous les projets
 * dépendants (`dependencies: ['setup']`) démarrent leurs contextes
 * avec ce storageState pré-rempli.
 *
 * Avantages mesurés :
 *  - 12 specs admin × ~3 s/login ⇒ ~36 s économisés par run complet,
 *  - login flakiness isolée à un seul point (au lieu de N points),
 *  - tests admin se concentrent sur leur scénario sans cérémonie auth.
 *
 * Le storageState est écrit dans `.auth/admin.json` (gitignored). Le
 * dossier est créé si nécessaire.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { test as setup } from '@playwright/test';

import { ADMIN_STORAGE_PATH, loginAdmin } from './helpers/auth';

setup('authenticate as admin', async ({ page }) => {
  // Compile-on-demand de Next dev (1re requête /admin/login → ~10 s)
  // peut dépasser le timeout par défaut de 30 s quand le serveur est
  // démarré juste avant les tests. 60 s couvre le worst case sans
  // masquer un vrai stall (login backend < 1 s, on tolère la compile).
  setup.setTimeout(60_000);
  await fs.mkdir(path.dirname(ADMIN_STORAGE_PATH), { recursive: true });

  await loginAdmin(page);

  // Dismiss du `ConsentBanner` une fois pour toutes : le bandeau est monté
  // dans `app/layout.tsx` (donc présent sur l'admin) et son overlay
  // `role="dialog" fixed inset-x-4 bottom-4 z-50` intercepte les clics
  // Playwright tant qu'aucune préférence n'est posée. Au lieu d'imposer
  // ce workaround à chaque spec admin (cf. `chat-mobile-ux.spec.ts`,
  // `tracking-public.spec.ts`), on persiste `fg_consent_chosen='1'`
  // directement dans le storageState. cf. ConsentBanner.tsx l.15.
  await page.evaluate(() => {
    window.localStorage.setItem('fg_consent_chosen', '1');
  });

  // Sauvegarde du contexte (cookies + localStorage) pour réutilisation
  // par les autres projets via `storageState`.
  await page.context().storageState({ path: ADMIN_STORAGE_PATH });
});
