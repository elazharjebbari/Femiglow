import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logLegalEvent } from '@/lib/legal/audit';
import { requireSameOrigin } from '@/lib/legal/csrf';
import {
  createLegalPage,
  getLegalPageBySlug,
  legalListStats,
  listAllTemplateVars,
  listLegalPages,
} from '@/lib/legal/repository';
import { legalPageDraftInputSchema, legalPageStatusSchema } from '@/lib/legal/types';
import { detectMissingVars } from '@/lib/legal/vars';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const url = new URL(request.url);
    const statusRaw = url.searchParams.get('status');
    const status = statusRaw ? legalPageStatusSchema.safeParse(statusRaw) : null;
    const pages = await listLegalPages({ status: status?.success ? status.data : undefined });
    const stats = await legalListStats();
    const vars = await listAllTemplateVars();

    const enriched = pages.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      body_md: p.bodyMd,
      status: p.status,
      version: p.version,
      include_in_search: p.includeInSearch,
      canonical_url: p.canonicalUrl,
      require_legal_review: p.requireLegalReview,
      last_legal_review_at: p.lastLegalReviewAt,
      published_at: p.publishedAt,
      updated_at: p.updatedAt,
      updated_by: p.updatedBy,
      missing_vars: detectMissingVars(p.bodyMd, vars),
    }));

    return NextResponse.json({ pages: enriched, stats });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    requireSameOrigin(request);

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = legalPageDraftInputSchema.safeParse(payload);
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

    const existing = await getLegalPageBySlug(parsed.data.slug);
    if (existing) throw new HttpError('conflict', 'Slug déjà utilisé.');

    const page = await createLegalPage({ ...parsed.data, actorId: session.adminId });
    await logLegalEvent('legal.page.created', session.adminId, page.id, { slug: page.slug });

    return NextResponse.json(
      {
        id: page.id,
        slug: page.slug,
        title: page.title,
        description: page.description,
        body_md: page.bodyMd,
        status: page.status,
        version: page.version,
      },
      { status: 201 },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
