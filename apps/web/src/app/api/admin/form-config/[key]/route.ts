/**
 * GET   /api/admin/form-config/[key] → row courante (active ou non).
 * PATCH /api/admin/form-config/[key] → update config + audit + revalidate.
 *
 * - PATCH requiert `If-Match: <version>` (optimistic lock).
 * - Validation Zod stricte (`formConfigJsonSchema`).
 * - Audit : `form-config.update`, resourceType=`form_config`, resourceId=`<key>`.
 * - Revalidation : `revalidatePath('/api/checkout/form-config/<key>')`.
 *
 * Cf. docs/admin-config/40-form-config-admin-integration-plan.md §4.1
 */
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formConfigRepo } from '@/lib/checkout/repos/form-config-repo';
import { patchFormConfigInputSchema } from '@/lib/checkout/form-config/schema';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KNOWN_KEYS = new Set(['wizard_kit', 'wizard_commander']);

function parseKey(value: string | undefined): string {
  if (!value || !KNOWN_KEYS.has(value)) {
    throw new HttpError('not_found', `form_config "${value ?? '?'}" inconnu.`);
  }
  return value;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ key: string }> | { key: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const key = parseKey(params.key);
    const row = await formConfigRepo.getByKey(key);
    if (!row) throw new HttpError('not_found', `form_config "${key}" introuvable.`);
    return NextResponse.json({
      key: row.key,
      version: row.version,
      active: row.active,
      description: row.description,
      config: row.config,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    });
  } catch (err) {
    logger.error('admin.form-config.get.failed', { error: String(err) });
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ key: string }> | { key: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const key = parseKey(params.key);

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

    const parsed = patchFormConfigInputSchema.safeParse(body);
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

    // Vérif optimistic lock avant l'update.
    const current = await formConfigRepo.getByKey(key);
    if (!current) {
      throw new HttpError('not_found', `form_config "${key}" introuvable.`);
    }
    if (current.version !== expectedVersion) {
      return NextResponse.json(
        {
          error: {
            code: 'version_conflict',
            message: `Version stale : courante=${current.version}, fournie=${expectedVersion}`,
            details: { currentVersion: current.version },
          },
        },
        { status: 409 },
      );
    }

    const updated = await formConfigRepo.update({
      key,
      config: parsed.data.config,
      description: parsed.data.description ?? null,
      active: parsed.data.active,
      actorId: session.adminId,
    });

    if (!updated) {
      throw new HttpError('internal_error', 'Update form_config a échoué.');
    }

    // Invalidate la route publique cache (revalidate=60).
    revalidatePath(`/api/checkout/form-config/${key}`);

    await logAuditEvent({
      action: 'form-config.update',
      actorId: session.adminId,
      resourceType: 'form_config',
      resourceId: key,
      meta: {
        version: updated.version,
        previousVersion: expectedVersion,
        description: updated.description,
      },
    });

    return NextResponse.json({
      key: updated.key,
      version: updated.version,
      active: updated.active,
      description: updated.description,
      config: updated.config,
      updatedAt: updated.updatedAt.toISOString(),
      updatedBy: updated.updatedBy,
    });
  } catch (err) {
    logger.error('admin.form-config.patch.failed', { error: String(err) });
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
