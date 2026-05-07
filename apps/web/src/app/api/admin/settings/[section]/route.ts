/**
 * GET    /api/admin/settings/[section] → section résolue
 * PATCH  /api/admin/settings/[section] → update + snapshot + revalidate + audit
 *
 * - PATCH requiert un header `If-Match: <version>` (optimistic lock).
 * - Validation Zod stricte ; échec → 422 avec issues.
 * - Audit log : `app-config.update`, resourceType=app_config, resourceId=<section>.
 * cf. docs/admin-config/backend/03-cache-revalidation.md
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { getSection, APP_CONFIG_TAG, sectionTag } from '@/lib/admin-config/resolve';
import { sectionSchemas } from '@/lib/admin-config/schemas';
import { upsertAppConfig } from '@/lib/db/queries/app-config';
import { SECTIONS, type Section } from '@/lib/admin-config/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseSection(value: string | undefined): Section {
  if (!value || !SECTIONS.includes(value as Section)) {
    throw new HttpError('not_found', `Section "${value ?? '?'}" inconnue.`);
  }
  return value as Section;
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ section: string }> | { section: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const section = parseSection(params.section);
    const resolved = await getSection(section);
    return NextResponse.json(resolved);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ section: string }> | { section: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const section = parseSection(params.section);

    const ifMatch = request.headers.get('If-Match');
    if (!ifMatch || Number.isNaN(Number(ifMatch))) {
      throw new HttpError(
        'invalid_input',
        'Header "If-Match" requis (version courante).',
      );
    }
    const expectedVersion = Number(ifMatch);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }

    // Le payload peut être encapsulé sous { payload, note } ou direct.
    let payloadInput: unknown = body;
    let note: string | null = null;
    if (
      body &&
      typeof body === 'object' &&
      'payload' in (body as Record<string, unknown>)
    ) {
      const b = body as { payload?: unknown; note?: string };
      payloadInput = b.payload;
      note = typeof b.note === 'string' && b.note.length > 0 ? b.note : null;
    }

    const schema = sectionSchemas[section];
    const parsed = schema.safeParse(payloadInput);
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

    const result = await upsertAppConfig(
      {
        section,
        payload: parsed.data,
        expectedVersion,
        actorId: session.adminId,
      },
      { note },
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          error: {
            code: 'version_conflict',
            message: `Version stale : courante=${result.currentVersion}, fournie=${expectedVersion}`,
            details: { currentVersion: result.currentVersion },
          },
        },
        { status: 409 },
      );
    }

    revalidateTag(APP_CONFIG_TAG);
    revalidateTag(sectionTag(section));

    await logAuditEvent({
      action: 'app-config.update',
      actorId: session.adminId,
      resourceType: 'app_config',
      resourceId: section,
      meta: {
        version: result.row.version,
        snapshotId: result.snapshot.id,
        note,
      },
    });

    return NextResponse.json({
      section,
      payload: result.row.payload,
      meta: {
        version: result.row.version,
        updatedAt: result.row.updatedAt,
        updatedBy: result.row.updatedBy,
        isDefault: false,
      },
      snapshotId: result.snapshot.id,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
