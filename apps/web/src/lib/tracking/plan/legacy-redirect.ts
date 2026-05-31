/**
 * Helper de redirection 302 pour les pages tracking legacy.
 *
 * Activable via `TRACKING_LEGACY_REDIRECT=on`. Quand actif, les routes
 * matching `LEGACY_PATHS` sont redirigées vers `/admin/tracking/plans`
 * avec un header `X-Deprecation` exploitable côté monitoring.
 *
 * À intégrer dans `src/middleware.ts` (cf. `attachLegacyRedirect`).
 */
import { NextResponse, type NextRequest } from 'next/server';

const LEGACY_PATHS: ReadonlyArray<{ prefix: string; replacement: string; reason: string }> = [
  {
    prefix: '/admin/tracking/events',
    replacement: '/admin/tracking/plans',
    reason: 'tracking-plan-v2-events-merged',
  },
  {
    prefix: '/admin/tracking/providers',
    replacement: '/admin/tracking/plans',
    reason: 'tracking-plan-v2-providers-merged',
  },
  {
    prefix: '/admin/tracking/gtm',
    replacement: '/admin/tracking/plans',
    reason: 'tracking-plan-v2-gtm-export-merged',
  },
];

export function legacyRedirectIfNeeded(request: NextRequest): NextResponse | null {
  if (process.env.TRACKING_LEGACY_REDIRECT !== 'on') return null;
  const { pathname } = request.nextUrl;
  const match = LEGACY_PATHS.find((p) => pathname.startsWith(p.prefix));
  if (!match) return null;
  const url = request.nextUrl.clone();
  url.pathname = match.replacement;
  url.search = '';
  // 302 (Found) explicite pour signifier "déprécié, peut revenir" si
  // jamais on rollback. `Next.redirect` retourne 307 par défaut, ici
  // on construit manuellement la NextResponse.
  const res = NextResponse.redirect(url, { status: 302 });
  res.headers.set('x-deprecation', `replaced-by:${match.replacement};reason:${match.reason}`);
  return res;
}

export const __test__ = { LEGACY_PATHS };
