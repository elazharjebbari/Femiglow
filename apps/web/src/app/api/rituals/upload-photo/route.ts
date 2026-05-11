import { NextResponse } from 'next/server';
import { PhotoValidationError, processPhoto } from '@/lib/rituals/photo-pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Rate-limit léger en mémoire (5 photos / IP / heure)
const counters = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = 5;

function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const current = counters.get(ip);
  if (!current || current.resetAt < now) {
    counters.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= LIMIT) return false;
  current.count += 1;
  return true;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimitOk(ip)) {
    return NextResponse.json(
      {
        error: {
          code: 'RATE_LIMIT',
          message: 'Trop d’uploads récents — réessayez dans une heure.',
        },
      },
      { status: 429 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'multipart attendu' } },
      { status: 400 },
    );
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'champ "file" manquant' } },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await processPhoto(buffer, file.type, { visionMlMode: 'sync' });

    return NextResponse.json(
      {
        data: {
          blobKey: result.blobKey,
          url: result.url,
          thumbUrl: result.thumbUrl,
          width: result.width,
          height: result.height,
          byteSize: result.byteSize,
          mime: result.mime,
          facesStatus: result.facesStatus,
          facesCount: result.facesCount,
        },
      },
      { status: 202 },
    );
  } catch (e) {
    if (e instanceof PhotoValidationError) {
      return NextResponse.json(
        { error: { code: e.code, message: e.message } },
        { status: 400 },
      );
    }
    console.error('[rituals/upload-photo] error', e);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL',
          message:
            'La maison n’a pas pu traiter votre photo. Essayez à nouveau dans un instant.',
        },
      },
      { status: 500 },
    );
  }
}
