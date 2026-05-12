/**
 * Seeder components — réutilise `runComponentsSeed()` du script CLI. Sync
 * du registre component + animations, crée les médias depuis
 * `docs/images/values/`, applique les bindings éditoriaux Components-CMS.
 *
 * Le runner Seeders (UI /admin/settings/seeders) passe `autoActivate=true`
 * afin que les bindings issus du mapping soient immédiatement actifs côté
 * public ; le CLI direct (`pnpm tsx scripts/seed-components.ts`) garde
 * `autoActivate=false` (default safe — l'admin peut activer manuellement).
 *
 * Mode par défaut : pas de `--force`, l'admin a la priorité (idempotent).
 */
import { runComponentsSeed } from '../../../../scripts/seed-components';
import type { SeederContext, SeederResult } from '../types';

export async function componentsSeeder(
  ctx: SeederContext,
): Promise<SeederResult> {
  ctx.onProgress?.('Sync registry + scan medias', 0.1);
  const report = await runComponentsSeed({ autoActivate: true });
  ctx.onProgress?.('Bindings éditoriaux', 0.8);

  const synced = report.components.synced;
  const animations = report.animations.synced;
  const seeded = report.images.seeded;
  const skipped = report.images.skipped;
  const activated = report.images.activated;
  const fields = report.fields.seeded;
  const errors = report.images.errors.length;

  return {
    stats: {
      componentsSynced: synced,
      animationsSynced: animations,
      mediasSeeded: seeded,
      mediasSkipped: skipped,
      mediasActivated: activated,
      fieldsBound: fields,
      durationMs: report.durationMs,
    },
    summary:
      `${synced} composants · ${animations} animations · ${seeded} médias seedés (${activated} activés, ${skipped} ignorés)` +
      `${errors ? ` · ⚠ ${errors} erreurs` : ''}`,
  };
}
