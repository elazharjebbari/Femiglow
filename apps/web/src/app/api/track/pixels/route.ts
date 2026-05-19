import { NextResponse } from 'next/server';
import { listEnabledTrackingProviders } from '@/lib/db/queries/tracking/providers';
import { getAdapter } from '@/lib/tracking/providers/registry';
import { formatErrorResponse } from '@/lib/errors/http-error';
import type { TrackingProvider, TrackingProviderKind } from '@/lib/db/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Providers dont le snippet client doit être omis quand GTM est actif :
 *   - le bootstrap est déjà émis par la balise GTM dédiée (TikTok Init),
 *   - et l'auto-Pageview du SDK (`ttq.page()`) n'a pas de dédup native
 *     côté TikTok (contrairement à `ttq.track('...', { event_id })`).
 *
 * Injecter le snippet ET la balise GTM produirait donc deux Pageviews
 * comptabilisés. Le compromis Meta/Snap (qui acceptent un éventuel double
 * fire grâce à fbq.loaded / SnapPixelEvents) n'est pas applicable ici.
 *
 * Cette politique est conservatrice : si GTM n'est pas enabled, le
 * snippet client reste le canal unique et reprend le rôle d'init.
 */
const PROVIDERS_SKIPPED_WHEN_GTM: ReadonlySet<TrackingProviderKind> = new Set([
  'tiktok',
]);

function filterForGtm(providers: TrackingProvider[]): TrackingProvider[] {
  const gtmActive = providers.some((p) => p.kind === 'gtm');
  if (!gtmActive) return providers;
  return providers.filter((p) => !PROVIDERS_SKIPPED_WHEN_GTM.has(p.kind));
}

export async function GET(): Promise<Response> {
  try {
    const providers = await listEnabledTrackingProviders();
    const eligible = filterForGtm(providers);
    const snippets = eligible.flatMap((provider) => {
      const adapter = getAdapter(provider.kind);
      if (!adapter || !adapter.clientSnippet) return [];
      const code = adapter.clientSnippet(provider);
      if (!code) return [];
      return [{ kind: provider.kind, code }];
    });
    return NextResponse.json(
      { snippets },
      { headers: { 'cache-control': 'private, max-age=60' } },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export const __test__ = { filterForGtm, PROVIDERS_SKIPPED_WHEN_GTM };
