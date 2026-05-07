/**
 * POST /api/admin/seo/audit — exécute le linter sur un candidat (live preview)
 * ou sur un override existant (id).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getOverrideById } from '@/lib/db/queries/seo';
import { runLinter } from '@/lib/seo/rules';
import { seoOverrideUpsertSchema } from '@/lib/seo/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const auditBodySchema = z
  .object({
    overrideId: z.string().min(1).optional(),
    candidate: seoOverrideUpsertSchema.partial().optional(),
  })
  .refine(
    (v) => Boolean(v.overrideId) || Boolean(v.candidate),
    'overrideId ou candidate requis.',
  );

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = auditBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: 'Body audit invalide.',
            details: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }

    const { overrideId, candidate } = parsed.data;
    const base = overrideId ? await getOverrideById(overrideId) : null;
    const merged = {
      scope: candidate?.scope ?? base?.scope,
      targetKey: candidate?.targetKey ?? base?.targetKey,
      locale: candidate?.locale ?? base?.locale,
      title: candidate?.title ?? base?.title ?? null,
      description: candidate?.description ?? base?.description ?? null,
      keywords: candidate?.keywords ?? base?.keywords ?? [],
      ogTitle: candidate?.ogTitle ?? base?.ogTitle ?? null,
      ogDescription: candidate?.ogDescription ?? base?.ogDescription ?? null,
      ogImageMediaId: candidate?.ogImageMediaId ?? base?.ogImageMediaId ?? null,
      ogImageTemplate: candidate?.ogImageTemplate ?? base?.ogImageTemplate ?? null,
      twitterCard: candidate?.twitterCard ?? base?.twitterCard ?? 'summary_large_image',
      canonical: candidate?.canonical ?? base?.canonical ?? null,
      robotsIndex: candidate?.robotsIndex ?? base?.robotsIndex ?? true,
      robotsFollow: candidate?.robotsFollow ?? base?.robotsFollow ?? true,
      structuredData: candidate?.structuredData ?? base?.structuredData ?? null,
    } as const;
    const report = runLinter(merged);
    return NextResponse.json({ report });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
