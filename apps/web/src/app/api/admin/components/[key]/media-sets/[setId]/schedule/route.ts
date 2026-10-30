/**
 * POST /api/admin/components/[key]/media-sets/[setId]/schedule
 *
 * Programme la publication d'un brouillon (≥ 1 minute dans le futur ; une
 * programmation existante peut être reprogrammée). Le cron
 * `promote-scheduled-fields` publiera l'ensemble à l'échéance et
 * invalidera le cache à ce moment-là : rien n'est invalidé ici, le public
 * ne voit pas encore de changement.
 *
 * Corps : `{ scheduledAt: ISO futur, expectedUpdatedAt? }`.
 * Refus : date passée (400 `schedule_in_past`), autre programmation en
 * attente sur la cellule (409 `invalid_state`).
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
import { scheduleSet } from '@/lib/db/queries/component-media-sets';
import { mediaSetTransitionHandler } from '@/lib/components/media-variants/transition-route';
import { mediaSetScheduleSchema } from '@/lib/schemas/admin/media-sets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = mediaSetTransitionHandler({
  route: 'POST media-sets/[setId]/schedule',
  action: 'media_set.schedule',
  schema: mediaSetScheduleSchema,
  revalidate: false,
  run: ({ setId, actorId, expectedUpdatedAt, body }) =>
    scheduleSet({ setId, actorId, expectedUpdatedAt, scheduledAt: new Date(body.scheduledAt) }),
  auditMeta: (body) => ({ scheduledAt: new Date(body.scheduledAt).toISOString() }),
});
