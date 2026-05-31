/**
 * POST /api/admin/seo/settings/reset
 *
 * Restaure les `seo_settings` aux valeurs par défaut du module SEO
 * (cf. `lib/seo/defaults.ts::seoSettingsDefault`).
 *
 * Garanties :
 *  - Auth admin requise (`getAdminSession`).
 *  - Snapshot de l'état précédent capturé dans l'audit event
 *    (`meta.previous`) pour permettre un retour en arrière manuel.
 *  - `revalidateTag(SEO_TAG)` invalide le cache global SEO de l'app
 *    pour que les pages publiques reflètent immédiatement les defaults.
 *
 * cf. `lib/seo/seed.ts::resetSeoSettingsToDefaults`.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { SEO_TAG } from '@/lib/seo/resolve';
import { resetSeoSettingsToDefaults } from '@/lib/seo/seed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const result = await resetSeoSettingsToDefaults({ actorId: session.adminId });

    revalidateTag(SEO_TAG);

    return NextResponse.json({
      settings: result.settings,
      reset: true,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
