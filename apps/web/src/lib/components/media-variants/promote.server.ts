/**
 * Médias par audience — promotion des ensembles programmés (crons).
 *
 * Appelé par `GET|POST /api/cron/promote-scheduled-fields` (tick) et
 * `POST /api/admin/components/cron/promote-now` (rattrapage manuel), APRÈS
 * la promotion des champs — y compris quand celle-ci a échoué. Ne lève
 * JAMAIS : une panne des ensembles (table absente, driver sans
 * transaction…) est rapportée dans la section `mediaSets` de la réponse.
 *
 *  - Dès qu'au moins un ensemble est promu : invalidation de `components`
 *    (même si la clé du composant n'a pas pu être lue) et de
 *    `components:media-sets:<key>` pour chaque clé connue — une seule passe,
 *    AVANT l'audit.
 *  - `skipped` (course avec un autre tick, publication manuelle) : info.
 *  - `stuck` (média supprimé dans un ensemble programmé) : UN avertissement
 *    par tick, pas d'erreur — l'admin le voit dans GET /media-sets.
 *  - `failed` : erreur journalisée par ensemble.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
import 'server-only';
import { logAuditEvent } from '@/lib/audit/log-event';
import { logger } from '@/lib/logging/logger';
import {
  promoteDueMediaSets,
  type PromoteDueMediaSetsResult,
} from '@/lib/db/queries/component-media-sets';
import { revalidateMediaSets } from './revalidate.server';

export interface MediaSetsPromotionSection {
  promoted: Array<{
    setId: string;
    componentKey: string | null;
    slot: string;
    variantDim: string;
    variantKey: string;
    locale: string;
    version: number;
  }>;
  skipped: PromoteDueMediaSetsResult['skipped'];
  stuck: PromoteDueMediaSetsResult['stuck'];
  failed: PromoteDueMediaSetsResult['failed'];
  /** Tags invalidés. */
  revalidated: string[];
  /** Erreur globale (la promotion n'a pas pu s'exécuter du tout). */
  error?: string;
}

export async function promoteDueMediaSetsSafely(opts: {
  trigger: 'cron' | 'manual';
  actorId: string | null;
  now?: Date;
}): Promise<MediaSetsPromotionSection> {
  const section: MediaSetsPromotionSection = {
    promoted: [],
    skipped: [],
    stuck: [],
    failed: [],
    revalidated: [],
  };
  try {
    const result = await promoteDueMediaSets(opts.now ?? new Date());
    section.skipped = result.skipped;
    section.stuck = result.stuck;
    section.failed = result.failed;
    section.promoted = result.promoted.map((s) => ({
      setId: s.id,
      componentKey: s.componentKey,
      slot: s.slot,
      variantDim: s.variantDim,
      variantKey: s.variantKey,
      locale: s.locale,
      version: s.version,
    }));

    // Invalidation d'abord : c'est ce qui rend la promotion visible.
    section.revalidated = revalidateMediaSets(
      section.promoted.map((p) => p.componentKey),
      `promote_media_sets.${opts.trigger}`,
    );

    for (const p of section.promoted) {
      await logAuditEvent({
        action: 'media_set.publish.scheduled',
        actorId: opts.actorId,
        resourceType: 'component_media_set',
        resourceId: p.setId,
        meta: {
          componentKey: p.componentKey,
          slot: p.slot,
          variantDim: p.variantDim,
          variantKey: p.variantKey,
          locale: p.locale,
          version: p.version,
          trigger: opts.trigger,
        },
      }).catch((err: unknown) => {
        logger.warn('cron.promote_media_sets.audit_failed', {
          set_id: p.setId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
    if (section.skipped.length > 0) {
      logger.info('cron.promote_media_sets.skipped', {
        trigger: opts.trigger,
        sets: section.skipped.map((s) => `${s.setId}:${s.reason}`),
      });
    }
    if (section.stuck.length > 0) {
      // Une seule ligne par tick : la programmation reste due tant que
      // l'admin n'a pas remplacé le média (sinon un log d'erreur par minute).
      logger.warn('cron.promote_media_sets.stuck', {
        trigger: opts.trigger,
        count: section.stuck.length,
        sets: section.stuck.map((s) => `${s.setId}:${s.issues.join('+')}`),
      });
    }
    for (const f of section.failed) {
      logger.error('cron.promote_media_sets.failed', { set_id: f.setId, error: f.error, trigger: opts.trigger });
    }
  } catch (err) {
    section.error = err instanceof Error ? err.message : String(err);
    logger.error('cron.promote_media_sets.crashed', { error: section.error, trigger: opts.trigger });
  }
  return section;
}
