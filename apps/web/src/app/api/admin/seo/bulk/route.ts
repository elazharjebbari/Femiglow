/**
 * POST /api/admin/seo/bulk
 *
 * Body : { action, ids: string[], note?: string }
 * Actions :
 *   - publish    : draft|published → published (snapshot + revalidate cache tag)
 *   - unpublish  : published → draft (clear publishedAt + revalidate)
 *   - delete     : suppression définitive (revalidate)
 *
 * Retour : { ok, action, summary: { processed, succeeded, skipped, failed }, results }
 *
 * Le revalidate ciblé `seoTargetTag(scope, targetKey)` est appelé pour chaque
 * override modifié ; on revalide aussi `/kit` quand l'override pointe sur le
 * produit `le-kit`. SEO_TAG est revalidé une seule fois en sortie pour ne pas
 * exploser la queue d'invalidation Next.
 */
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import {
  deleteOverride,
  getOverrideById,
  publishOverride,
  unpublishOverride,
} from '@/lib/db/queries/seo';
import { SEO_TAG, seoTargetTag } from '@/lib/seo/resolve';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BULK_ACTIONS = ['publish', 'unpublish', 'delete'] as const;
type BulkAction = (typeof BULK_ACTIONS)[number];

const bodySchema = z.object({
  action: z.enum(BULK_ACTIONS),
  ids: z.array(z.string().min(1)).min(1).max(200),
  note: z.string().max(500).optional(),
});

interface ItemResult {
  id: string;
  ok: boolean;
  reason?: string;
  scope?: string;
  targetKey?: string;
}

async function applyOne(
  action: BulkAction,
  id: string,
  actorId: string | null,
  note: string | undefined,
): Promise<ItemResult> {
  const existing = await getOverrideById(id);
  if (!existing) return { id, ok: false, reason: 'not_found' };

  switch (action) {
    case 'publish': {
      const result = await publishOverride(id, actorId);
      if (!result) return { id, ok: false, reason: 'publish_failed' };
      revalidateTag(seoTargetTag(result.override.scope, result.override.targetKey));
      if (
        result.override.scope === 'product' &&
        result.override.targetKey === 'le-kit'
      ) {
        revalidatePath('/kit');
      }
      await logAuditEvent({
        action: 'seo.publish',
        actorId,
        resourceType: 'seo_override',
        resourceId: result.override.id,
        meta: {
          scope: result.override.scope,
          targetKey: result.override.targetKey,
          snapshotId: result.snapshot.id,
          bulk: true,
          note: note ?? null,
        },
      });
      return {
        id,
        ok: true,
        scope: result.override.scope,
        targetKey: result.override.targetKey,
      };
    }
    case 'unpublish': {
      if (existing.publishedAt === null) {
        return { id, ok: false, reason: 'already_draft' };
      }
      const updated = await unpublishOverride(id);
      if (!updated) return { id, ok: false, reason: 'unpublish_failed' };
      revalidateTag(seoTargetTag(updated.scope, updated.targetKey));
      if (updated.scope === 'product' && updated.targetKey === 'le-kit') {
        revalidatePath('/kit');
      }
      await logAuditEvent({
        action: 'seo.unpublish',
        actorId,
        resourceType: 'seo_override',
        resourceId: updated.id,
        meta: {
          scope: updated.scope,
          targetKey: updated.targetKey,
          bulk: true,
        },
      });
      return { id, ok: true, scope: updated.scope, targetKey: updated.targetKey };
    }
    case 'delete': {
      const ok = await deleteOverride(id);
      if (!ok) return { id, ok: false, reason: 'delete_failed' };
      revalidateTag(seoTargetTag(existing.scope, existing.targetKey));
      if (existing.scope === 'product' && existing.targetKey === 'le-kit') {
        revalidatePath('/kit');
      }
      await logAuditEvent({
        action: 'seo.delete',
        actorId,
        resourceType: 'seo_override',
        resourceId: id,
        meta: {
          scope: existing.scope,
          targetKey: existing.targetKey,
          bulk: true,
        },
      });
      return { id, ok: true, scope: existing.scope, targetKey: existing.targetKey };
    }
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: 'Body bulk invalide.',
            details: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }

    const { action, ids, note } = parsed.data;
    const results: ItemResult[] = [];
    for (const id of ids) {
      try {
        results.push(await applyOne(action, id, session.adminId, note));
      } catch (err) {
        results.push({
          id,
          ok: false,
          reason: err instanceof Error ? err.message : 'error',
        });
      }
    }

    // Une seule invalidation globale en sortie.
    revalidateTag(SEO_TAG);

    const summary = {
      processed: results.length,
      succeeded: results.filter((r) => r.ok).length,
      skipped: results.filter((r) => !r.ok && r.reason && r.reason !== 'not_found').length,
      failed: results.filter((r) => !r.ok && r.reason === 'not_found').length,
    };

    return NextResponse.json({ ok: true, action, summary, results });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
