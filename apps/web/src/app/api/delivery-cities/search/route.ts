/**
 * GET /api/delivery-cities/search
 *
 * Endpoint **publique** d'autocomplete villes. Pas d'auth.
 *
 *  - q (string, optional)        — texte saisi. Vide → top-N alphabétique.
 *  - limit (1..50, default 8)    — taille de la fenêtre de retour.
 *  - countryCode (ISO-2, default 'MA')
 *  - includeInactive=true        — IGNORÉ (toujours forcé à false côté public —
 *                                  protège contre les leaks de villes désactivées).
 *
 * Réponse :
 *   { items: PublicCity[], total: number, query: string }
 *
 * Où `PublicCity` est un sous-ensemble du DTO admin (pas de metadata, pas
 * d'audit timestamps) pour minimiser la surface exposée.
 *
 * Cache : `s-maxage=300, stale-while-revalidate=900`. Le catalogue ne change
 * pratiquement jamais ; un staleness de 5 minutes est acceptable.
 *
 * Feature flag — rollback safety
 * ──────────────────────────────
 *  Si `NEXT_PUBLIC_USE_DB_CITIES === 'false'` (case insensitive), le handler
 *  sert le dataset statique `MOROCCAN_CITIES` au lieu d'interroger la DB.
 *  Voir aussi `use-delivery-cities.ts` pour le pendant client. La cohérence
 *  entre client et serveur garantit que tous les flux (wizard, mode B, /kit
 *  admin preview) retombent sur la même donnée en cas de kill-switch.
 */
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logging/logger';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { searchDeliveryCities, type DeliveryCity } from '@/lib/db/queries/delivery-cities';
import { deliveryCitySearchQuerySchema } from '@/lib/checkout/delivery/schemas';
import {
  MOROCCAN_CITIES,
  searchCities as searchStaticCities,
  type MoroccanCity,
} from '@/lib/checkout/data/moroccan-cities';

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

/** Pendant statique de `toPublic`, sur le shape `MoroccanCity`. */
function staticToPublic(c: MoroccanCity): PublicCity {
  return {
    slug: c.value,
    nameFr: c.label,
    nameAr: c.labelAr,
    deliveryPriceMad: 0,
    deliveryEta: '24-48h',
    aliases: c.aliases ?? [],
  };
}

/**
 * Voir use-delivery-cities.ts pour la source de vérité — on duplique ici
 * pour éviter d'importer un module client ("use client"). Garder en sync.
 */
function isDbCitiesEnabled(): boolean {
  const raw = (process.env.NEXT_PUBLIC_USE_DB_CITIES ?? '').trim().toLowerCase();
  if (!raw) return true;
  return !['false', '0', 'off', 'no'].includes(raw);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const raw = {
      q: url.searchParams.get('q') ?? '',
      limit: url.searchParams.get('limit') ?? undefined,
      countryCode: url.searchParams.get('countryCode') ?? undefined,
      // `includeInactive` est ignoré côté public — voir entête du fichier.
    };
    const parsed = deliveryCitySearchQuerySchema.safeParse(raw);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Paramètres invalides', parsed.error.issues);
    }
    const { q, limit, countryCode } = parsed.data;

    // ── Kill-switch : sert le dataset statique au lieu de toucher la DB.
    if (!isDbCitiesEnabled()) {
      const staticItems = (q.trim()
        ? searchStaticCities(q, limit)
        : MOROCCAN_CITIES.slice(0, limit)
      ).map(staticToPublic);
      const res = NextResponse.json({
        items: staticItems,
        total: staticItems.length,
        query: q,
      });
      // Pas de cache server-side variable : la flag est en build-time/process
      // env, donc l'output est stable jusqu'au prochain redéploiement.
      res.headers.set(
        'Cache-Control',
        'public, s-maxage=300, stale-while-revalidate=900',
      );
      return res;
    }

    const items = await searchDeliveryCities(q, {
      limit,
      countryCode,
      includeInactive: false,
    });

    const res = NextResponse.json({
      items: items.map(toPublic),
      total: items.length,
      query: q,
    });
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=900',
    );
    return res;
  } catch (err) {
    logger.error('delivery-cities.search.failed', { error: String(err) });
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
