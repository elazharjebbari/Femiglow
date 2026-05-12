/**
 * GET /api/delivery-cities/[slug]
 *
 * Lookup public d'une ville par slug stable. Pas d'auth.
 *
 * Cas d'usage côté UI :
 *   - Hydratation d'un récap commande après reload (le store conserve juste
 *     le slug ; on re-fetch les détails à l'affichage).
 *   - Lien partagé / deep-link `/commander?city=casablanca`.
 *
 * Réponse :
 *   { city: PublicCity }   (200)
 *   { error: { code, message } }  (404 si introuvable ou inactif)
 *
 * Cache : `s-maxage=300, stale-while-revalidate=900` (idem search).
 */
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logging/logger';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { findDeliveryCityBySlug, type DeliveryCity } from '@/lib/db/queries/delivery-cities';

export const runtime = 'nodejs';
export const revalidate = 60;

interface PublicCity {
  slug: string;
  nameFr: string;
  nameAr: string | null;
  deliveryPriceMad: number;
  deliveryEta: string;
  aliases: string[];
}

function toPublic(c: DeliveryCity): PublicCity {
  return {
    slug: c.slug,
    nameFr: c.nameFr,
    nameAr: c.nameAr,
    deliveryPriceMad: c.deliveryPriceMad,
    deliveryEta: c.deliveryEta,
    aliases: c.aliases,
  };
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> | { slug: string } },
): Promise<Response> {
  try {
    const params = await Promise.resolve(ctx.params);
    const slug = (params.slug ?? '').trim().toLowerCase();
    if (!slug || slug.length > 80) {
      throw new HttpError('invalid_input', 'Slug invalide');
    }
    const city = await findDeliveryCityBySlug(slug);
    if (!city || !city.isActive) {
      throw new HttpError('not_found', 'Ville introuvable.');
    }
    const res = NextResponse.json({ city: toPublic(city) });
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=900',
    );
    return res;
  } catch (err) {
    logger.error('delivery-cities.find.failed', { error: String(err) });
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
