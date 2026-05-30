/**
 * GET  /api/admin/i18n/config → config moteur résolue + version (If-Match).
 * PUT  /api/admin/i18n/config → publie la config + snapshot + revalidate + audit.
 *
 * Section `i18n_suggestion_engine` (ADR-009). PUT optimiste (`If-Match`),
 * validation Zod stricte (`engineConfigSchema`) → 422, conflit → 409, audit
 * `i18n-engine.update` (before/after/note), invalidation `i18n-suggestion-engine`.
 *
 * Le plancher zone calme (NEVER-CHECKOUT/NEVER-FORM, INV-14) est **structurel**
 * dans la politique L9 (jamais pilotable ici) — aucune réinjection à faire.
 *
 * @see docs/locale-switcher-v2/10-suggestion-engine/02-config/admin-feature-spec.md §4
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { logAuditEvent } from '@/lib/audit/log-event';
import { getAdminSession } from '@/lib/auth/require-admin';
import { upsertAppConfig } from '@/lib/db/queries/app-config';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  ENGINE_CONFIG_SECTION,
  ENGINE_CONFIG_TAG,
  getAdminEngineConfig,
} from '@/lib/i18n/engine-config';
import { engineConfigSchema } from '@/lib/i18n/engine-config-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const { payload, version, updatedAt, updatedBy, isDefault } =
      await getAdminEngineConfig();
    return NextResponse.json({
      section: ENGINE_CONFIG_SECTION,
      payload,
      meta: { version, updatedAt, updatedBy, isDefault },
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

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

    // Payload encapsulé sous { payload, note } ou direct.
    let payloadInput: unknown = body;
    let note: string | null = null;
    if (body && typeof body === 'object' && 'payload' in (body as object)) {
      const b = body as { payload?: unknown; note?: unknown };
      payloadInput = b.payload;
      note = typeof b.note === 'string' && b.note.length > 0 ? b.note : null;
    }

    const parsed = engineConfigSchema.safeParse(payloadInput);
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

    const before = (await getAdminEngineConfig()).payload;

    const result = await upsertAppConfig(
      {
        section: ENGINE_CONFIG_SECTION,
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

    revalidateTag(ENGINE_CONFIG_TAG);

    await logAuditEvent({
      action: 'i18n-engine.update',
      actorId: session.adminId,
      resourceType: 'app_config',
      resourceId: ENGINE_CONFIG_SECTION,
      meta: {
        version: result.row.version,
        snapshotId: result.snapshot.id,
        note,
        before,
        after: result.row.payload,
      },
    });

    return NextResponse.json({
      section: ENGINE_CONFIG_SECTION,
      payload: result.row.payload,
      meta: {
        version: result.row.version,
        updatedAt:
          result.row.updatedAt instanceof Date
            ? result.row.updatedAt.toISOString()
            : String(result.row.updatedAt),
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
