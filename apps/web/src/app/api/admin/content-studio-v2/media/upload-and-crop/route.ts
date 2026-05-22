/**
 * Content Studio v2 — POST /media/upload-and-crop
 *
 * Multipart upload with two fields:
 *  - `file` : image binary (JPEG / PNG / WebP, ≤ 25 MB)
 *  - `crop` : JSON string matching ImageCropRequest from
 *    `lib/content-studio-v2/media/types.ts`
 *
 * Returns 201 with a `StudioV2MediaItem`.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { env } from '@/lib/env';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { checkRateLimit } from '@/lib/rate-limit/check';
import { uploadAndCropImage } from '@/lib/content-studio-v2/media/upload-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const cropSchema = z.object({
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().min(-360).max(360).optional(),
  aspectRatio: z.string().optional(),
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
      key: `cs-v2-upload:${ip}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rate.ok) throw new HttpError('rate_limited', 'Trop de requêtes');

    const form = await request.formData();
    const file = form.get('file');
    const cropRaw = form.get('crop');
    if (!(file instanceof File)) throw new HttpError('invalid_input', 'Fichier manquant');
    if (typeof cropRaw !== 'string') throw new HttpError('invalid_input', 'Paramètre crop manquant');

    let cropJson: unknown;
    try {
      cropJson = JSON.parse(cropRaw);
    } catch {
      throw new HttpError('invalid_input', 'JSON crop invalide');
    }
    const crop = cropSchema.safeParse(cropJson);
    if (!crop.success) {
      throw new HttpError('invalid_input', 'Crop invalide', crop.error.flatten());
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const item = await uploadAndCropImage({
      file: buffer,
      filename: file.name,
      mime: file.type || 'image/jpeg',
      crop: crop.data,
      adminId: session.adminId,
    });

    return NextResponse.json({ media: item }, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
