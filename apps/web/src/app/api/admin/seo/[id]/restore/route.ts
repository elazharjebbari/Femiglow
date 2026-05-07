/**
 * POST /api/admin/seo/[id]/restore
 * Body: { snapshotId: string }
 *
 * Recopie le payload d'un snapshot dans le draft de l'override (sans publier).
 * Re-valide le payload via Zod (skip si schéma a évolué).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import {
  getOverrideById,
  listAuditSnapshots,
  upsertOverride,
} from '@/lib/db/queries/seo';
import { seoOverrideUpsertSchema } from '@/lib/seo/schemas';
import type { SeoOverride } from '@/lib/seo/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ snapshotId: z.string().min(1) });

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const override = await getOverrideById(params.id);
    if (!override) throw new HttpError('not_found', 'Override introuvable.');

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: 'Body restore invalide.',
            details: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }

    const snapshots = await listAuditSnapshots(
      override.scope,
      override.targetKey,
      override.locale,
      100,
    );
    const snap = snapshots.find((s) => s.id === parsed.data.snapshotId);
    if (!snap) throw new HttpError('not_found', 'Snapshot introuvable.');

    // Re-valide via le schéma actuel (failsafe schéma migré).
    const payload = snap.payload as Partial<SeoOverride> | null;
    if (!payload || typeof payload !== 'object') {
      throw new HttpError('invalid_input', 'Snapshot payload invalide.');
    }
    const reparsed = seoOverrideUpsertSchema.safeParse({
      scope: payload.scope,
      targetKey: payload.targetKey,
      locale: payload.locale,
      title: payload.title ?? null,
      description: payload.description ?? null,
      keywords: payload.keywords ?? [],
      ogTitle: payload.ogTitle ?? null,
      ogDescription: payload.ogDescription ?? null,
      ogImageMediaId: payload.ogImageMediaId ?? null,
      ogImageTemplate: payload.ogImageTemplate ?? null,
      twitterCard: payload.twitterCard ?? 'summary_large_image',
      canonical: payload.canonical ?? null,
      robotsIndex: payload.robotsIndex ?? true,
      robotsFollow: payload.robotsFollow ?? true,
      structuredData: payload.structuredData ?? null,
    });
    if (!reparsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'snapshot_incompatible',
            message: 'Snapshot incompatible avec le schéma actuel.',
            details: reparsed.error.issues,
          },
        },
        { status: 422 },
      );
    }

    const restored = await upsertOverride({
      id: override.id,
      ...reparsed.data,
      actorId: session.adminId,
    });

    await logAuditEvent({
      action: 'seo.restore',
      actorId: session.adminId,
      resourceType: 'seo_override',
      resourceId: override.id,
      meta: {
        snapshotId: snap.id,
        scope: override.scope,
        targetKey: override.targetKey,
      },
    });

    return NextResponse.json({ override: restored });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
