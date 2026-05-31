/**
 * CHA-232 — Endpoint public lecture seule pour le flag `freeShipping`.
 *
 * Pourquoi public : le flag pilote l'affichage côté checkout (wizard + Mode B
 * + admin /kit) ; il n'expose aucune donnée sensible — uniquement le booléen
 * `freeShipping`. Pas d'auth, cache 60s + SWR 300s pour absorber la charge.
 */
import { NextResponse } from 'next/server';
import { getShippingConfig } from '@/lib/checkout/shipping-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = await getShippingConfig();
  return NextResponse.json(config, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
