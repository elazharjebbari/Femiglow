/**
 * POST `/api/admin/products/feed/revalidate`
 *
 * Force la régénération immédiate du feed `/feed.xml` (Google Merchant)
 * en purgeant les caches Next.js liés :
 *  - `revalidateTag('product-feed')` → invalide `getCachedKitFeedXml`,
 *  - `revalidateTag('product:le-kit')` → invalide `getKitProductCached`,
 *  - `revalidatePath('/feed.xml')` → invalide la sortie statique du
 *    route handler côté Next ISR,
 *  - `revalidatePath('/kit')` → invalide la page publique (utile si
 *    l'admin a édité le pricing/promo et veut que la vitrine se mette
 *    à jour en même temps que le feed).
 *
 * Les quatre revalidations sont déjà encapsulées dans
 * `revalidateProduct(KIT_PRODUCT_SLUG)` — on l'appelle simplement.
 *
 * Cas d'usage :
 *  - Après un changement de pricing produit non détecté par
 *    `revalidateProduct` (ex : changement d'images via le storage,
 *    refresh manuel du fallback mock).
 *  - Après une modification du builder `kit-feed.ts` (copywriting),
 *    quand le serveur est déjà déployé mais qu'on veut éviter
 *    d'attendre la fenêtre ISR de 30 min.
 *  - Diagnostic : forcer un re-fetch côté Google Merchant Center sans
 *    redéployer.
 *
 * Audit : `product.feed.revalidate` avec l'admin actor + le slug, pour
 * traçabilité des purges manuelles (utile pour debug si le feed
 * « disparaît » silencieusement après une mauvaise revalidation).
 */
import { NextResponse } from 'next/server';

import { logAuditEvent } from '@/lib/audit/log-event';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logger } from '@/lib/logging/logger';
import { revalidateProduct } from '@/lib/products/cache';
import { KIT_PRODUCT_SLUG } from '@/lib/products/public';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  const startedAt = Date.now();
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    revalidateProduct(KIT_PRODUCT_SLUG);

    await logAuditEvent({
      action: 'product.feed.revalidate',
      actorId: session.adminId,
      resourceType: 'product',
      resourceId: KIT_PRODUCT_SLUG,
      meta: {
        slug: KIT_PRODUCT_SLUG,
        trigger: 'admin-ui',
      },
    });

    const durationMs = Date.now() - startedAt;
    logger.info('admin.product_feed.revalidated', {
      slug: KIT_PRODUCT_SLUG,
      actor_id: session.adminId,
      duration_ms: durationMs,
    });

    return NextResponse.json({
      ok: true,
      slug: KIT_PRODUCT_SLUG,
      revalidatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
