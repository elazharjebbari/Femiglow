/**
 * POST /api/admin/kit/video/cover/test-url
 *
 * Body : `{ url: string }`. Vérifie via HEAD que l'URL est HTTPS, retourne
 * un content-type `image/svg+xml`, et fait moins de 200 kB. Ne télécharge
 * pas le SVG — c'est le client qui le chargera via `<img src=…>`.
 *
 * Auth admin obligatoire (pas d'audit log car non-mutateur).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { validateSvgUrl } from '@/lib/kit/video/sanitize-svg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ url: z.string().min(1).max(500) });

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: 'Body invalide',
            details: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }

    const result = await validateSvgUrl(parsed.data.url);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
