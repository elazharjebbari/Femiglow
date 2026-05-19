/**
 * Seed SEO — settings globaux uniquement (defaults code).
 *
 * Différent du script `seed-seo.ts` historique qui pose aussi des
 * overrides éditoriaux par page (potentiellement obsolètes pour la
 * marque FemiGlow soin des ongles). Ce script reste neutre sur les
 * overrides et se concentre sur la singleton `seo_settings`.
 *
 * Idempotent par défaut : ne touche pas la DB si une config est déjà
 * persistée. Le drapeau `--force` (ou `--reset`) écrase systématiquement
 * en sauvegardant l'état précédent dans l'audit log.
 *
 * Usage :
 *   pnpm seed:seo:defaults              # idempotent
 *   pnpm seed:seo:defaults -- --force   # écrase
 *   pnpm seed:seo:defaults -- --reset   # alias de --force
 *
 * Sortie : status JSON sur stdout (parsable par CI / post-deploy hooks).
 */
import './_load-env.mjs';

import { resetSeoSettingsToDefaults, seedSeoDefaults } from '@/lib/seo/seed';

async function main() {
  const argv = process.argv.slice(2);
  const reset = argv.includes('--reset');
  const force = reset || argv.includes('--force');

  const result = reset
    ? await resetSeoSettingsToDefaults({ actorId: null })
    : await seedSeoDefaults({ actorId: null, force });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        applied: result.applied,
        reason: result.reason,
        siteName: result.settings.siteName,
        updatedAt: result.settings.updatedAt.toISOString(),
      },
      null,
      2,
    ),
  );

  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed:seo:defaults] failure', err);
  process.exit(1);
});
