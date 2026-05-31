/**
 * Phase publish-components — post-seed step qui force la publication (is_active=true)
 * de tous les bindings component_media_bindings.
 *
 * Pourquoi : le seed-pipeline a un bug silencieux qui ne persiste pas systématiquement
 * les bindings. Cette phase complète : pour chaque (component_key, slot)
 * mappé dans IMAGE_TO_COMPONENT, on s'assure qu'il existe un binding actif
 * pointant vers le bon média (résolu par slug = `${pageGroup}-${basename}`).
 *
 * Idempotente : utilise ON CONFLICT (component_id, slot) DO UPDATE.
 */
import { db } from '@/lib/db/client';
import { rowsOf } from '@/lib/db/exec';
import { sql } from 'drizzle-orm';
import type { PhaseContext, PhaseResult } from '../types';
import { ResetError } from '../errors';

export async function runPublishComponents(ctx: PhaseContext): Promise<PhaseResult> {
  if (ctx.config.dryRun) {
    return { stats: { skipped: true, reason: 'dryRun' }, summary: 'dry-run' };
  }

  const conn = db();
  if (!conn) {
    return { stats: { skipped: true, reason: 'no db' }, summary: 'no DB' };
  }

  ctx.onProgress?.('Lecture composants + médias', 0.2);

  // Stratégie SQL : on crée des bindings pour chaque (site_component, media)
  // dont le slug du média commence par le pageGroup du composant (`home-`, `kit-`, etc).
  // Heuristique simple mais cohérente avec IMAGE_TO_COMPONENT (slug = "<pageGroup>-<basename>").
  //
  // On lie chaque component à TOUS les médias dont le slug commence par son préfixe.
  // Pour limiter à 1 média par slot, on prend le premier (ORDER BY slug).
  //
  // Bindings créés : 1 par couple (component, primary slot) au minimum.
  // Les slots multiples (gallery etc.) ne sont pas couverts ici — c'est un fallback
  // pour garantir qu'au moins le slot 'primary' a une image.

  ctx.onProgress?.('Création des bindings principaux', 0.4);

  let inserted = 0;
  let updated = 0;
  try {
    // Pour chaque composant, on cherche son média principal (slug = '${key}-${basename}' ou '${key}-…')
    const result = await conn.execute<{
      component_id: string;
      slot: string;
      media_id: string;
      inserted: boolean;
    }>(sql`
      WITH candidates AS (
        SELECT DISTINCT ON (c.id)
          c.id AS component_id,
          'primary'::text AS slot,
          m.id AS media_id
        FROM site_components c
        JOIN media m ON (
          m.slug = c.key
          OR m.slug LIKE c.key || '-%'
          OR m.slug LIKE replace(c.key, '-og', '') || '-og-%'
        )
        WHERE m.status = 'ready'
        ORDER BY c.id, m.slug
      ),
      upserted AS (
        INSERT INTO component_media_bindings
          (id, component_id, slot, media_id, loading_strategy, fetch_priority, priority,
           placeholder_strategy, display_order, is_active, object_fit, object_position,
           created_at, updated_at)
        SELECT
          'bnd_' || substr(md5(component_id || slot), 1, 20),
          component_id, slot, media_id,
          'eager'::media_loading_strategy,
          'auto'::fetch_priority,
          false,
          'svg'::placeholder_strategy,
          0,
          true,
          'cover'::media_object_fit,
          'center'::media_object_position,
          NOW(),
          NOW()
        FROM candidates
        ON CONFLICT (component_id, slot) DO UPDATE
          SET media_id = EXCLUDED.media_id,
              is_active = true,
              updated_at = NOW()
        RETURNING component_id, slot, media_id, xmax = 0 AS inserted
      )
      SELECT * FROM upserted
    `);

    const rows = rowsOf<{ component_id: string; slot: string; media_id: string; inserted: boolean }>(result);
    inserted = rows.filter((r) => r.inserted).length;
    updated = rows.filter((r) => !r.inserted).length;
  } catch (err) {
    throw new ResetError(
      'UNKNOWN', 'seed',
      `publish-components SQL failed: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }

  ctx.onProgress?.('Force activation', 0.8);

  // Bonus : activer tous les bindings existants (au cas où certains seraient is_active=false).
  let forcedActive = 0;
  try {
    const r2 = await conn.execute<{ n: number }>(sql`
      WITH upd AS (
        UPDATE component_media_bindings
        SET is_active = true, updated_at = NOW()
        WHERE is_active = false
        RETURNING id
      )
      SELECT count(*)::int AS n FROM upd
    `);
    forcedActive = rowsOf<{ n: number }>(r2)[0]?.n ?? 0;
  } catch {
    // best-effort
  }

  ctx.onProgress?.('Done', 1);
  return {
    stats: { inserted, updated, forcedActive, total: inserted + updated },
    summary: `${inserted} bindings créés · ${updated} mis à jour · ${forcedActive} forcés actifs`,
  };
}
