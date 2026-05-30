/**
 * Locale Switcher V2 — `GET /api/i18n/config` (lot L4).
 *
 * Lecture **publique** (pas d'auth) de la config locale résolue (section
 * `i18n_locale_config`, fallback défauts INV-12). Caché (s-maxage + SWR)
 * pour absorber la charge ; aucune donnée sensible.
 *
 * @see docs/locale-switcher-v2/04-backend/api-contracts.md
 */
import { NextResponse } from 'next/server';

import { getResolvedLocaleConfig } from '@/lib/i18n/locale-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const config = await getResolvedLocaleConfig();
  return NextResponse.json(config, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
