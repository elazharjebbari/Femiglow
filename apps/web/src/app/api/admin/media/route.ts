import { NextResponse } from 'next/server';
import { createId } from '@/lib/ids';
import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { logger } from '@/lib/logging/logger';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { checkRateLimit } from '@/lib/rate-limit/check';
import { mediaListFiltersSchema, mediaUploadSchema } from '@/lib/schemas/admin/media';
import { createMedia, listMedia, thumbsByMediaId } from '@/lib/db/queries/media';
import { enqueueJob } from '@/lib/db/queries/media-jobs';
import { getStorage } from '@/lib/media/storage';
import { validateUpload } from '@/lib/media/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const url = new URL(request.url);
    const parsed = mediaListFiltersSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) throw new HttpError('invalid_input', 'Filtres invalides');
    const result = await listMedia(parsed.data);
    const thumbs = await thumbsByMediaId(result.rows.map((m) => m.id));
    return NextResponse.json({
      ...result,
      rows: result.rows.map((m) => ({ ...m, thumbUrl: thumbs.get(m.id) })),
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rate = await checkRateLimit({
      key: `media-upload:${ip}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rate.ok) throw new HttpError('rate_limited', 'Trop de requêtes');

    const form = await request.formData();
    const file = form.get('file');
    const metaRaw = form.get('metadata');
    if (!(file instanceof File)) throw new HttpError('invalid_input', 'Fichier manquant');
    if (typeof metaRaw !== 'string') throw new HttpError('invalid_input', 'Métadonnées manquantes');
    const meta = mediaUploadSchema.safeParse(JSON.parse(metaRaw));
    if (!meta.success) throw new HttpError('invalid_input', 'Métadonnées invalides');

    const buffer = Buffer.from(await file.arrayBuffer());
    const validated = await validateUpload(buffer, meta.data.kind);

    const media = await createMedia({
      kind: meta.data.kind,
      source: meta.data.source,
      slug: meta.data.slug,
      alt: meta.data.alt,
      caption: meta.data.caption ?? null,
      credit: meta.data.credit ?? null,
      originalFilename: file.name,
      originalMime: validated.mime,
      originalSizeBytes: validated.sizeBytes,
      originalUrl: meta.data.externalUrl ?? null,
      qualityProfile: meta.data.qualityProfile,
      loadingStrategy: meta.data.loadingStrategy,
      isHero: meta.data.isHero,
      createdBy: session.adminId,
    });

    const sourceKey = `sources/${media.id}/${createId('src')}.${validated.ext}`;
    await getStorage().put({ key: sourceKey, body: buffer, contentType: validated.mime });
    await enqueueJob({ mediaId: media.id, kind: 'optimize', payload: { sourceKey } });

    await logAuditEvent({
      action: 'media.uploaded',
      actorId: session.adminId,
      resourceType: 'media',
      resourceId: media.id,
      meta: { kind: media.kind, size: validated.sizeBytes, mime: validated.mime },
    });
    logger.info('media.uploaded', { id: media.id, kind: media.kind });

    return NextResponse.json({ id: media.id, slug: media.slug, status: media.status }, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
