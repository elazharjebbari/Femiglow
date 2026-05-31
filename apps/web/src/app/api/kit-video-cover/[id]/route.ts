/**
 * GET /api/kit-video-cover/[id]
 *
 * Sert publiquement un SVG cover uploadé via l'admin. Cache-Control long
 * car le contenu est immuable (un nouvel upload = un nouvel id).
 *
 * Sécurité : le contenu a été sanitized DOMPurify côté serveur au moment
 * de l'upload. On re-sanitize au service (défense en profondeur).
 */
import { NextResponse } from 'next/server';

import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getKitVideoCoverFile } from '@/lib/kit/video/cover-files-store';
import { sanitizeSvgInline } from '@/lib/kit/video/sanitize-svg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const id = params.id;
    if (!id || !/^kvc_[A-Za-z0-9_-]+$/.test(id)) {
      throw new HttpError('not_found', 'Cover introuvable');
    }
    const record = getKitVideoCoverFile(id);
    if (!record) {
      throw new HttpError('not_found', 'Cover introuvable');
    }
    // Re-sanitize au service (défense en profondeur).
    const { ok, sanitized } = sanitizeSvgInline(record.content);
    if (!ok) {
      throw new HttpError('not_found', 'Cover invalide');
    }
    return new Response(sanitized, {
      status: 200,
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
