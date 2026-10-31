/**
 * GET / PATCH / DELETE /api/admin/media/[id]
 *
 * Invalidation : après une modification (PATCH) ou une suppression
 * (DELETE), `components` (liaisons historiques) et
 * `components:media-sets:<key>` des composants dont un ensemble référence
 * le média sont invalidés — ils sont en cache 30 min et ne doivent pas
 * continuer à servir un média supprimé ou modifié. L'invalidation précède
 * l'audit, qui ne fait jamais échouer une mutation déjà committée.
 *
 * Suppression définitive (`?hard=true`) d'un média référencé par un
 * ensemble (FK `ON DELETE RESTRICT`, `MediaInUseError`) ou par une autre
 * table (FK 23503) → 409 avec, si possible, la liste des ensembles.
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { mediaUpdateSchema } from '@/lib/schemas/admin/media';
import {
  MediaInUseError,
  findMediaById,
  getMediaWithRelations,
  hardDeleteMedia,
  softDeleteMedia,
  updateMedia,
} from '@/lib/db/queries/media';
import { listMediaSetUsages, type MediaSetUsage } from '@/lib/db/queries/component-media-sets';
import { revalidateForMediaChange } from '@/lib/components/media-variants/revalidate.server';
import { logger } from '@/lib/logging/logger';
import { describeMediaSetUsage } from '@/lib/media/media-set-usage';
import { enqueueJob } from '@/lib/db/queries/media-jobs';
import type { MediaOverrides } from '@/lib/db/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Audit après une mutation déjà committée : ne doit ni masquer le succès
 * par un 500 ni empêcher l'invalidation (journalisé en erreur).
 */
async function auditSafely(input: Parameters<typeof logAuditEvent>[0]): Promise<void> {
  try {
    await logAuditEvent(input);
  } catch (err) {
    logger.error('admin.media.audit_failed', {
      action: input.action,
      media_id: input.resourceId ?? null,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Violation de clé étrangère Postgres (23503), y compris enveloppée (`cause`). */
function isForeignKeyViolation(err: unknown): boolean {
  let cur: unknown = err;
  for (let depth = 0; depth < 4 && cur && typeof cur === 'object'; depth += 1) {
    if ((cur as { code?: unknown }).code === '23503') return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

/** 409 explicite pour une suppression définitive refusée (média encore référencé). */
async function mediaInUseError(mediaId: string): Promise<HttpError> {
  const usages = await listMediaSetUsages(mediaId).catch((err: unknown) => {
    logger.warn('media.delete.usage_lookup_failed', {
      media_id: mediaId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [] as MediaSetUsage[];
  });
  const message =
    usages.length > 0
      ? `Suppression définitive impossible : ce média est utilisé par ${usages.length} ensemble(s) de médias — ${usages
          .slice(0, 5)
          .map(describeMediaSetUsage)
          .join(' ; ')}${usages.length > 5 ? ' ; …' : ''}. Retirez-le de ces ensembles (ou abandonnez les brouillons) avant de le supprimer définitivement.`
      : 'Suppression définitive impossible : ce média est encore référencé ailleurs sur le site. Retirez ses usages ou utilisez la suppression simple.';
  return new HttpError('conflict', message, { mediaId, usages });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const media = await getMediaWithRelations(params.id);
    if (!media) throw new HttpError('not_found', 'Media introuvable');
    return NextResponse.json(media);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = mediaUpdateSchema.safeParse(json);
    if (!parsed.success) throw new HttpError('invalid_input', 'Payload invalide');

    const before = await findMediaById(params.id);
    if (!before) throw new HttpError('not_found', 'Media introuvable');

    const next = await updateMedia(params.id, {
      ...parsed.data,
      overrides: parsed.data.overrides as MediaOverrides | undefined,
    });

    const overrideTouched =
      parsed.data.overrides !== undefined || parsed.data.qualityProfile !== undefined;
    if (overrideTouched && before.kind === 'image') {
      await enqueueJob({ mediaId: params.id, kind: 'regenerate', payload: { reason: 'override' } });
    }

    // Alt, statut… sont lus par les ensembles publiés et les liaisons (cache
    // 30 min) : invalider d'abord (ciblé par usages), puis auditer.
    await revalidateForMediaChange([params.id], 'PATCH admin/media/[id]');
    await auditSafely({
      action: 'media.metadata_updated',
      actorId: session.adminId,
      resourceType: 'media',
      resourceId: params.id,
      meta: { keys: Object.keys(parsed.data) },
    });
    return NextResponse.json({ id: next.id });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const url = new URL(request.url);
    const hard = url.searchParams.get('hard') === 'true';
    const before = await findMediaById(params.id);
    if (!before) throw new HttpError('not_found', 'Media introuvable');
    if (hard) {
      try {
        await hardDeleteMedia(params.id);
      } catch (err) {
        if (err instanceof MediaInUseError || isForeignKeyViolation(err)) {
          throw await mediaInUseError(params.id);
        }
        throw err;
      }
    } else {
      await softDeleteMedia(params.id);
    }
    // Un ensemble publié qui pointait vers ce média doit retomber au niveau
    // de repli suivant tout de suite, pas après expiration du cache —
    // invalidation AVANT l'audit (la suppression est déjà committée).
    await revalidateForMediaChange([params.id], 'DELETE admin/media/[id]');
    await auditSafely({
      action: 'media.deleted',
      actorId: session.adminId,
      resourceType: 'media',
      resourceId: params.id,
      meta: { mode: hard ? 'hard' : 'soft' },
    });
    return NextResponse.json({ id: params.id, deleted: true, mode: hard ? 'hard' : 'soft' });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
