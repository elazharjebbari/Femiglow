/**
 * Tests du filtre client-snippet quand GTM est actif.
 *
 * Invariant : le snippet TikTok client est strictement réservé au cas
 * "pas de GTM" (dev local, intégration alternative). Dès que GTM est
 * activé en provider, c'est la balise GTM `TikTok Init` qui prend
 * l'unique rôle de bootstrap pour éviter un double `ttq.page()` non
 * dédupliqué (cf. plan-action TikTok intégration).
 */
import { describe, expect, it } from 'vitest';

import { filterForGtm, PROVIDERS_SKIPPED_WHEN_GTM } from './filter-for-gtm';
import type { TrackingProvider, TrackingProviderKind } from '@/lib/db/types';

// Namespace conservé pour limiter le diff côté tests existants ; les
// helpers sont désormais exportés depuis `./filter-for-gtm` (séparation
// imposée par le type-check strict de `route.ts` côté Next.js 14).
const __test__ = { filterForGtm, PROVIDERS_SKIPPED_WHEN_GTM };

function row(kind: TrackingProviderKind, overrides: Partial<TrackingProvider> = {}): TrackingProvider {
  return {
    id: `tpr_${kind}`,
    kind,
    status: 'enabled',
    pixelId: 'pixel-x',
    capiToken: null,
    capiTokenIv: null,
    capiTokenTag: null,
    testEventCode: null,
    customHead: null,
    customBody: null,
    config: {},
    enabledEvents: [],
    lastEventAt: null,
    errorCount24h: 0,
    lastError: null,
    createdAt: new Date('2026-05-19T00:00:00Z'),
    updatedAt: new Date('2026-05-19T00:00:00Z'),
    ...overrides,
  };
}

describe('GET /api/track/pixels — filterForGtm', () => {
  it('removes TikTok from the client snippet list when GTM is also enabled', () => {
    const out = __test__.filterForGtm([row('meta'), row('tiktok'), row('gtm')]);
    const kinds = out.map((p) => p.kind);
    expect(kinds).toContain('meta');
    expect(kinds).toContain('gtm');
    expect(kinds).not.toContain('tiktok');
  });

  it('keeps TikTok when GTM is NOT enabled (no GTM container to take over the bootstrap)', () => {
    const out = __test__.filterForGtm([row('meta'), row('tiktok')]);
    const kinds = out.map((p) => p.kind);
    expect(kinds).toContain('meta');
    expect(kinds).toContain('tiktok');
  });

  it('leaves meta and snap untouched even when GTM is enabled (compromise accepted)', () => {
    // Meta & Snap ont leurs propres mécanismes de dédup côté SDK ; la
    // politique conservatrice ne s'applique qu'à TikTok dont
    // `ttq.page()` n'a pas d'event_id.
    const out = __test__.filterForGtm([row('meta'), row('snap'), row('gtm')]);
    const kinds = out.map((p) => p.kind);
    expect(kinds).toContain('meta');
    expect(kinds).toContain('snap');
    expect(kinds).toContain('gtm');
  });

  it('exposes the skip set so changes are reviewed (anti-régression contract)', () => {
    expect(__test__.PROVIDERS_SKIPPED_WHEN_GTM.has('tiktok')).toBe(true);
    expect(__test__.PROVIDERS_SKIPPED_WHEN_GTM.has('meta')).toBe(false);
    expect(__test__.PROVIDERS_SKIPPED_WHEN_GTM.has('snap')).toBe(false);
  });

  it('returns the input unchanged when no providers are enabled', () => {
    expect(__test__.filterForGtm([])).toEqual([]);
  });

  it('returns the input unchanged when GTM is the only provider', () => {
    const arr = [row('gtm')];
    expect(__test__.filterForGtm(arr)).toEqual(arr);
  });
});
