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
  await fs.mkdir(path.dirname(ADMIN_STORAGE_PATH), { recursive: true });

  await loginAdmin(page);

  // Sauvegarde du contexte (cookies + localStorage) pour réutilisation
  // par les autres projets via `storageState`.
  await page.context().storageState({ path: ADMIN_STORAGE_PATH });
});
