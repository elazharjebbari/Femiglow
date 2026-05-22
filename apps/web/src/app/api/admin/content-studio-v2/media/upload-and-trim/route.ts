/**
 * Content Studio v2 — POST /media/upload-and-trim
 *
 * Multipart upload with two fields:
 *  - `file` : video binary (mp4 / mov / webm, ≤ 200 MB)
 *  - `trim` : JSON `{ startSec, endSec, alt }`, max kept duration 90 s
 *
 * Returns 201 with a `StudioV2MediaItem` (kind=video, with poster thumbnail).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { env } from '@/lib/env';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { checkRateLimit } from '@/lib/rate-limit/check';
import { uploadAndTrimVideo } from '@/lib/content-studio-v2/media/upload-video';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const trimSchema = z.object({
  startSec: z.number().min(0),
  endSec: z.number().positive(),
  alt: z.string().min(1).max(280),
});

export async function POST(request: Request): Promise<Response> {
  try {
    if (env.CONTENT_STUDIO_V2_ENABLED !== 'true') {
      throw new HttpError('invalid_state', 'Content Studio v2 désactivé');
    }
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rate = await checkRateLimit({
      key: `cs-v2-upload-vid:${ip}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rate.ok) throw new HttpError('rate_limited', 'Trop de requêtes vidéo');

    const form = await request.formData();
    const file = form.get('file');
    const trimRaw = form.get('trim');
    if (!(file instanceof File)) throw new HttpError('invalid_input', 'Fichier manquant');
    if (typeof trimRaw !== 'string') throw new HttpError('invalid_input', 'Paramètre trim manquant');

    let trimJson: unknown;
    try {
      trimJson = JSON.parse(trimRaw);
    } catch {
      throw new HttpError('invalid_input', 'JSON trim invalide');
    }
    const trim = trimSchema.safeParse(trimJson);
    if (!trim.success) throw new HttpError('invalid_input', 'Trim invalide', trim.error.flatten());

    const buffer = Buffer.from(await file.arrayBuffer());
    const item = await uploadAndTrimVideo({
      file: buffer,
      filename: file.name,
      mime: file.type || 'video/mp4',
      trim: trim.data,
      adminId: session.adminId,
    });

    return NextResponse.json({ media: item }, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
