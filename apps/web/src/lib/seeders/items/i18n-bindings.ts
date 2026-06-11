/**
 * Seeder i18n-bindings — provisionne les traductions AR + EN des champs de
 * composants Content Studio dans `component_field_bindings`, à parité avec le
 * FR (lui aussi seedé `published` par le seeder `components`).
 *
 * Source : les CSV préparés `docs/i18n-content-2026-05/03-seed-data/
 * component-bindings-{ar,en}.csv`. Réutilise `runI18nBindingsSeed` (parsing,
 * pré-flight, invariant I0).
 *
 * Différence avec le CLI `pnpm seed:i18n-bindings` (qui insère en `draft`,
 * workflow de revue founder) : ici on insère en **`published`** pour que
 * `/ar/*` et `/en/*` affichent le contenu localisé dès le provisioning (sinon
 * la résolution publique, qui ne lit que les bindings `published`, retombe sur
 * le FR). cf. lib/db/queries/component-fields.ts.
 *
 * Idempotent : l'invariant I0 (admin priorité) préserve tout binding existant
 * (draft OU published) — un re-run n'écrase jamais une édition admin ni une
 * traduction déjà publiée ; il n'insère que les triplets manquants.
 *
 * Dépendance d'ordre : doit tourner APRÈS `components` (les bindings portent une
 * FK `component_id` → `site_components`).
 */
import {
  runI18nBindingsSeed,
  SEEDABLE_LOCALES,
} from '../../i18n/seed-bindings';
import type { SeederContext, SeederResult } from '../types';

export async function i18nBindingsSeeder(
  ctx: SeederContext,
): Promise<SeederResult> {
  ctx.onProgress?.('seed i18n bindings (AR + EN)', 0.1);

  const report = await runI18nBindingsSeed({
    locales: [...SEEDABLE_LOCALES],
    status: 'published',
    // Provisioning : pas d'écriture de rapport JSON sur disque.
    skipReportWrite: true,
  });

  ctx.onProgress?.('done', 1);

  const { totals } = report;
  const perLocale = report.perLocale
    .map((r) => `${r.locale}:${r.inserted}+`)
    .join(' ');

  return {
    stats: {
      inserted: totals.inserted,
      skipped: totals.skipped,
      updated: totals.updated,
      errors: totals.errors,
      orphans: totals.orphans,
    },
    summary:
      `${totals.inserted} bindings publiés · ${totals.skipped} préservés (I0) · ` +
      `${totals.errors} erreurs · ${totals.orphans} orphelins [${perLocale}]`,
  };
}
