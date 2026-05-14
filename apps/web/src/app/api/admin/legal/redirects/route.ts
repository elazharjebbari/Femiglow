import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logLegalEvent } from '@/lib/legal/audit';
import { requireSameOrigin } from '@/lib/legal/csrf';
import {
  createSlugRedirect,
  deleteSlugRedirect,
  listSlugRedirects,
} from '@/lib/legal/redirects';
import { legalSlugSchema } from '@/lib/legal/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createBodySchema = z.object({
  oldSlug: legalSlugSchema,
  newSlug: legalSlugSchema,
});

const deleteBodySchema = z.object({
  oldSlug: legalSlugSchema,
});

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const rows = await listSlugRedirects();
    return NextResponse.json(
      rows.map((r) => ({
        old_slug: r.oldSlug,
        new_slug: r.newSlug,
        created_at: r.createdAt,
        created_by: r.createdBy,
      })),
    );
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
    const parsed = createBodySchema.safeParse(payload);
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

    const result = await createSlugRedirect({
      oldSlug: parsed.data.oldSlug,
      newSlug: parsed.data.newSlug,
      actorId: session.adminId,
    });

    if (!result.ok) {
      if (result.reason === 'identical') {
        return NextResponse.json(
          { error: { code: 'invalid_input', message: 'old_slug et new_slug identiques.' } },
          { status: 400 },
        );
      }
      if (result.reason === 'duplicate') {
        return NextResponse.json(
          { error: { code: 'conflict', message: 'Ce slug a déjà un redirect.' } },
          { status: 409 },
        );
      }
      throw new HttpError('internal_error', 'Erreur DB');
    }

    await logLegalEvent('legal.page.created', session.adminId, result.row.oldSlug, {
      action: 'slug_redirect_created',
      old_slug: result.row.oldSlug,
      new_slug: result.row.newSlug,
    });

    return NextResponse.json(
      {
        old_slug: result.row.oldSlug,
        new_slug: result.row.newSlug,
        created_at: result.row.createdAt,
      },
      { status: 201 },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(request: Request): Promise<Response> {
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
    const parsed = deleteBodySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: 'old_slug invalide.' } },
        { status: 400 },
      );
    }

    const ok = await deleteSlugRedirect(parsed.data.oldSlug);
    if (!ok) throw new HttpError('not_found', 'Redirect non trouvé.');

    await logLegalEvent('legal.page.archived', session.adminId, parsed.data.oldSlug, {
      action: 'slug_redirect_deleted',
      old_slug: parsed.data.oldSlug,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
