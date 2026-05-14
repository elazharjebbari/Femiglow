import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logLegalEvent } from '@/lib/legal/audit';
import { requireSameOrigin } from '@/lib/legal/csrf';
import { requireLegalPermission } from '@/lib/legal/permissions';
import {
  archiveLegalPage,
  getLegalPageBySlug,
  listAllPlacements,
  listAllTemplateVars,
  updateLegalPageWithLock,
} from '@/lib/legal/repository';
import { legalPageUpdateInputSchema } from '@/lib/legal/types';
import { detectMissingVars } from '@/lib/legal/vars';

function buildETag(updatedAt: Date): string {
  return `W/"${updatedAt.getTime()}"`;
}

function parseIfMatch(header: string | null): number | null {
  if (!header) return null;
  const match = header.match(/W\/"(\d+)"/);
  if (!match) return null;
  return Number(match[1]);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const page = await getLegalPageBySlug(params.slug);
    if (!page) throw new HttpError('not_found', 'Page non trouvée');

    const [placements, vars] = await Promise.all([listAllPlacements(), listAllTemplateVars()]);
    const pagePlacements = placements.filter((p) => p.pageSlug === page.slug);

    return NextResponse.json(
      {
        id: page.id,
        slug: page.slug,
        title: page.title,
        description: page.description,
        body_md: page.bodyMd,
        status: page.status,
        version: page.version,
        include_in_search: page.includeInSearch,
        canonical_url: page.canonicalUrl,
        require_legal_review: page.requireLegalReview,
        last_legal_review_at: page.lastLegalReviewAt,
        published_at: page.publishedAt,
        updated_at: page.updatedAt,
        updated_by: page.updatedBy,
        placements: pagePlacements,
        missing_vars: detectMissingVars(page.bodyMd, vars),
      },
      { headers: { ETag: buildETag(page.updatedAt) } },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    requireSameOrigin(request);
    await requireLegalPermission('write', session);

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = legalPageUpdateInputSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: 'Payload invalide',
            details: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }

    const ifMatchTs = parseIfMatch(request.headers.get('if-match'));
    const outcome = await updateLegalPageWithLock(params.slug, {
      ...parsed.data,
      actorId: session.adminId,
      expectedUpdatedAt: ifMatchTs ?? undefined,
    });

    if (!outcome.ok) {
      if (outcome.reason === 'not_found') {
        throw new HttpError('not_found', 'Page non trouvée');
      }
      // version_conflict
      return NextResponse.json(
        {
          error: {
            code: 'version_conflict',
            message: 'La page a été modifiée par un autre admin. Recharge la page pour voir la dernière version.',
            currentUpdatedAt: outcome.currentUpdatedAt,
          },
        },
        {
          status: 409,
          headers: outcome.currentUpdatedAt
            ? { ETag: buildETag(outcome.currentUpdatedAt) }
            : undefined,
        },
      );
    }

    const updated = outcome.page;
    await logLegalEvent('legal.page.updated', session.adminId, updated.id, {
      slug: updated.slug,
      fields: Object.keys(parsed.data),
    });

    return NextResponse.json(
      {
        id: updated.id,
        slug: updated.slug,
        title: updated.title,
        description: updated.description,
        body_md: updated.bodyMd,
        status: updated.status,
        version: updated.version,
        updated_at: updated.updatedAt,
      },
      { headers: { ETag: buildETag(updated.updatedAt) } },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    requireSameOrigin(request);
    await requireLegalPermission('delete', session);

    const existing = await getLegalPageBySlug(params.slug);
    if (!existing) throw new HttpError('not_found', 'Page non trouvée');
    if (existing.status === 'published') {
      throw new HttpError(
        'conflict',
        'Page actuellement publiée — dépubliez avant archivage.',
      );
    }

    const archived = await archiveLegalPage(params.slug, session.adminId);
    if (archived) {
      await logLegalEvent('legal.page.archived', session.adminId, archived.id, {
        slug: archived.slug,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
