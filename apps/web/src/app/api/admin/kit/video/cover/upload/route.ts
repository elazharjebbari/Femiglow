/**
 * POST /api/admin/kit/video/cover/upload
 *
 * Accepte un SVG en raw text (content-type `image/svg+xml`) ou en JSON
 * `{ content: string }`. Sanitize, stocke, retourne `{ fileMediaId, size }`.
 *
 * Auth admin obligatoire. Audit log `kit_video.cover.upload`.
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { saveKitVideoCoverFile } from '@/lib/kit/video/cover-files-store';
import { sanitizeSvgInline } from '@/lib/kit/video/sanitize-svg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = 200_000;

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const contentType = request.headers.get('content-type') ?? '';
    let raw: string;
    if (contentType.includes('application/json')) {
      const body = (await request.json().catch(() => null)) as
        | { content?: unknown }
        | null;
      if (!body || typeof body.content !== 'string') {
        throw new HttpError('invalid_input', 'Body JSON doit contenir { content: string }.');
      }
      raw = body.content;
    } else if (contentType.includes('image/svg+xml') || contentType.includes('text/plain')) {
      raw = await request.text();
    } else {
      throw new HttpError(
        'invalid_input',
        `Content-Type non supporté : « ${contentType} ». Attendu : application/json ou image/svg+xml.`,
      );
    }

    const size = new TextEncoder().encode(raw).length;
    if (size > MAX_UPLOAD_BYTES) {
      throw new HttpError(
        'invalid_input',
        `SVG trop volumineux (${size} > ${MAX_UPLOAD_BYTES} octets).`,
      );
    }

    const { ok, sanitized, warnings, reason } = sanitizeSvgInline(raw);
    if (!ok) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: reason ?? 'SVG invalide.',
          },
        },
        { status: 422 },
      );
    }

    const record = saveKitVideoCoverFile(sanitized, session.adminId);
    await logAuditEvent({
      action: 'kit_video.cover.upload',
      actorId: session.adminId,
      resourceType: 'kit_video_cover_file',
      resourceId: record.id,
      meta: { size: record.size, warnings },
    });

    return NextResponse.json(
      {
        fileMediaId: record.id,
        size: record.size,
        warnings,
      },
      { status: 201 },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
