/**
 * POST /api/admin/settings/[section]/restore
 * Body: { snapshotId: string, note?: string }
 *
 * Recopie le payload du snapshot via un upsert qui crée une nouvelle version
 * + un nouveau snapshot (audit trail conservé). Le restore N'écrase pas
 * la version courante : il en crée une nouvelle.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { sectionSchemas } from '@/lib/admin-config/schemas';
import { APP_CONFIG_TAG, sectionTag } from '@/lib/admin-config/resolve';
import {
  getSnapshotById,
  getAppConfigRow,
  upsertAppConfig,
} from '@/lib/db/queries/app-config';
import { SECTIONS, type Section } from '@/lib/admin-config/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RestoreBody {
  snapshotId?: string;
  note?: string;
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ section: string }> | { section: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    if (!SECTIONS.includes(params.section as Section)) {
      throw new HttpError('not_found', `Section "${params.section}" inconnue.`);
    }
    const section = params.section as Section;

    let body: RestoreBody;
    try {
      body = (await request.json()) as RestoreBody;
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    if (!body.snapshotId) throw new HttpError('invalid_input', 'snapshotId requis.');

    const snap = await getSnapshotById(body.snapshotId);
    if (!snap || snap.section !== section) {
      throw new HttpError('not_found', 'Snapshot introuvable pour cette section.');
    }

    const parsed = sectionSchemas[section].safeParse(snap.payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: 'Payload du snapshot invalide pour le schéma courant.',
            details: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }

    const current = await getAppConfigRow(section);
    const expectedVersion = current?.version ?? 0;
    const note = body.note ?? `Restauré du snapshot ${snap.id}`;

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
            message: 'Version stale.',
            details: { currentVersion: result.currentVersion },
          },
        },
        { status: 409 },
      );
    }

    revalidateTag(APP_CONFIG_TAG);
    revalidateTag(sectionTag(section));

    await logAuditEvent({
      action: 'app-config.restore',
      actorId: session.adminId,
      resourceType: 'app_config',
      resourceId: section,
      meta: {
        sourceSnapshotId: snap.id,
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
