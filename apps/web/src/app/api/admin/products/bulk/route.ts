/**
 * POST /api/admin/products/bulk
 *
 * Body : { action, slugs: string[], note?: string }
 * Actions :
 *   - publish        : draft|published → published (snapshot)
 *   - unpublish      : published → draft
 *   - archive        : * → archived
 *   - restore-status : archived → draft
 *   - hard-delete    : archived → supprimé définitivement
 *
 * Retour : { ok, summary: { processed, succeeded, skipped, failed } }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import {
  archiveProduct,
  deleteProduct,
  getProductBySlug,
  publishProduct,
  restoreProduct,
  unpublishProduct,
} from '@/lib/db/queries/products';
import { revalidateProduct } from '@/lib/products/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BULK_ACTIONS = [
  'publish',
  'unpublish',
  'archive',
  'restore-status',
  'hard-delete',
] as const;
type BulkAction = (typeof BULK_ACTIONS)[number];

const bodySchema = z.object({
  action: z.enum(BULK_ACTIONS),
  slugs: z.array(z.string().min(1)).min(1).max(200),
  note: z.string().max(500).optional(),
});

interface ItemResult {
  slug: string;
  ok: boolean;
  reason?: string;
}

async function applyOne(
  action: BulkAction,
  slug: string,
  actorId: string | null,
  note: string | undefined,
): Promise<ItemResult> {
  const existing = await getProductBySlug(slug);
  if (!existing) return { slug, ok: false, reason: 'not_found' };

  switch (action) {
    case 'publish': {
      const variants = existing.variants;
      if (variants.length === 0) {
        return { slug, ok: false, reason: 'no_variants' };
      }
      const result = await publishProduct(slug, actorId, note);
      if (!result) return { slug, ok: false, reason: 'publish_failed' };
      revalidateProduct(slug);
      await logAuditEvent({
        action: 'product.publish',
        actorId,
        resourceType: 'product',
        resourceId: result.product.id,
        meta: { slug, snapshotId: result.snapshot.id, bulk: true, note: note ?? null },
      });
      return { slug, ok: true };
    }
    case 'unpublish': {
      if (existing.product.status !== 'published') {
        return { slug, ok: false, reason: 'not_published' };
      }
      const updated = await unpublishProduct(slug);
      if (!updated) return { slug, ok: false, reason: 'unpublish_failed' };
      revalidateProduct(slug);
      await logAuditEvent({
        action: 'product.unpublish',
        actorId,
        resourceType: 'product',
        resourceId: updated.id,
        meta: { slug, bulk: true },
      });
      return { slug, ok: true };
    }
    case 'archive': {
      if (existing.product.status === 'archived') {
        return { slug, ok: false, reason: 'already_archived' };
      }
      const updated = await archiveProduct(slug);
      if (!updated) return { slug, ok: false, reason: 'archive_failed' };
      revalidateProduct(slug);
      await logAuditEvent({
        action: 'product.archive',
        actorId,
        resourceType: 'product',
        resourceId: updated.id,
        meta: { slug, bulk: true },
      });
      return { slug, ok: true };
    }
    case 'restore-status': {
      if (existing.product.status !== 'archived') {
        return { slug, ok: false, reason: 'not_archived' };
      }
      const updated = await restoreProduct(slug);
      if (!updated) return { slug, ok: false, reason: 'restore_failed' };
      revalidateProduct(slug);
      await logAuditEvent({
        action: 'product.restore_status',
        actorId,
        resourceType: 'product',
        resourceId: updated.id,
        meta: { slug, bulk: true },
      });
      return { slug, ok: true };
    }
    case 'hard-delete': {
      if (existing.product.status !== 'archived') {
        return { slug, ok: false, reason: 'must_be_archived' };
      }
      const deleted = await deleteProduct(slug);
      if (!deleted) return { slug, ok: false, reason: 'delete_failed' };
      revalidateProduct(slug);
      await logAuditEvent({
        action: 'product.hard_delete',
        actorId,
        resourceType: 'product',
        resourceId: existing.product.id,
        meta: { slug, title: existing.product.title, bulk: true },
      });
      return { slug, ok: true };
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

    const { action, slugs, note } = parsed.data;
    const results: ItemResult[] = [];
    for (const slug of slugs) {
      try {
        results.push(await applyOne(action, slug, session.adminId, note));
      } catch (err) {
        results.push({
          slug,
          ok: false,
          reason: err instanceof Error ? err.message : 'error',
        });
      }
    }

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
