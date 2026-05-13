import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  LEGAL_PAGE_TAG,
  LEGAL_PUBLISHED_TAG,
} from '@/lib/legal/cache-tags';
import { requireSameOrigin } from '@/lib/legal/csrf';
import { publishLegalPage } from '@/lib/legal/publish';
import { listPagesUsingVar } from '@/lib/legal/repository';
import { legalTemplateVarKeySchema } from '@/lib/legal/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  varKey: legalTemplateVarKeySchema,
});

interface RepublishResult {
  slug: string;
  ok: boolean;
  code?: string;
  version?: number;
}

/**
 * POST /api/admin/legal/bulk-republish — republie toutes les pages
 * actuellement `published` qui référencent {{varKey}} dans leur bodyMd.
 *
 * Use case : admin met à jour la var COMPANY_RC ; toutes les pages
 * publiées qui l'utilisent doivent être re-publiées pour propager la
 * nouvelle valeur (sinon le cache + l'historique gardent l'ancienne).
 *
 * Comportement :
 *  - Sequential (pas parallèle) pour éviter contention DB sur transaction
 *  - 4-eyes désactivé volontairement : c'est l'admin actuel qui republie
 *    son propre travail, pas une nouvelle revue juridique.
 *  - Renvoie un tableau de résultats par slug.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    requireSameOrigin(request);

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = bodySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_failed', message: 'varKey invalide' } },
        { status: 422 },
      );
    }

    const slugs = await listPagesUsingVar(parsed.data.varKey);
    const results: RepublishResult[] = [];

    for (const slug of slugs) {
      // Bypass 4-eyes guard : admin republie son propre travail
      const res = await publishLegalPage(slug, 'PUBLIER', session.adminId);
      if (res.ok) {
        results.push({ slug, ok: true, version: res.version });
        revalidatePath(`/legal/${slug}`);
        revalidateTag(LEGAL_PAGE_TAG(slug));
      } else {
        results.push({
          slug,
          ok: false,
          code: 'code' in res ? res.code : 'unknown',
        });
      }
    }

    revalidateTag(LEGAL_PUBLISHED_TAG);
    revalidatePath('/sitemap.xml');

    return NextResponse.json({
      varKey: parsed.data.varKey,
      total: slugs.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
