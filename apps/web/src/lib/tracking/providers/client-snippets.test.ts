/**
 * Client snippet verification tests for all providers.
 *
 * Verifies that:
 *  1. Each provider with clientSnippet returns correct init code
 *  2. Disabled providers or missing pixelId → null
 *  3. Snap does NOT auto-fire PAGE_VIEW (no double event)
 *  4. Meta DOES auto-fire PageView (expected behavior for Meta pixel)
 *  5. TikTok auto-fires ttq.page() (standard TikTok behavior)
 *  6. Pinterest auto-fires pintrk('page') (standard Pinterest behavior)
 *  7. Google Ads and GTM return null (client-only via GTM container)
 *  8. CSP hosts are correct for each provider
 */
import { describe, expect, it } from 'vitest';

import type { TrackingProvider } from '@/lib/db/types';
import { metaAdapter } from './meta';
import { snapAdapter } from './snap';
import { tiktokAdapter } from './tiktok';
import { pinterestAdapter } from './pinterest';
import { googleAdsAdapter } from './google-ads';
import { gtmAdapter } from './gtm';
import { googleAdapter } from './google';

function provider(kind: string, overrides: Partial<TrackingProvider> = {}): TrackingProvider {
  return {
    id: `tpr_${kind}`,
    kind: kind as TrackingProvider['kind'],
    status: 'enabled',
    pixelId: `${kind}-pixel-123`,
    capiToken: 'encrypted',
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
    createdAt: new Date('2026-05-17T10:00:00Z'),
    updatedAt: new Date('2026-05-17T10:00:00Z'),
    ...overrides,
  };
}

// ─── Meta ────────────────────────────────────────────────────────────

describe('Meta client snippet', () => {
  it('retourne un snippet avec le pixel ID', () => {
    const p = provider('meta', { pixelId: '1234567890' });
    const snippet = metaAdapter.clientSnippet!(p);
    expect(snippet).not.toBeNull();
    expect(snippet!).toContain("fbq('init','1234567890')");
  });

  it('inclut le track PageView (comportement normal Meta)', () => {
    const p = provider('meta');
    const snippet = metaAdapter.clientSnippet!(p);
    expect(snippet).toContain("fbq('track','PageView')");
  });

  it('retourne null si provider désactivé', () => {
    expect(metaAdapter.clientSnippet!(provider('meta', { status: 'disabled' }))).toBeNull();
  });

  it('retourne null si pixelId manquant', () => {
    expect(metaAdapter.clientSnippet!(provider('meta', { pixelId: null }))).toBeNull();
  });

  it('CSP hosts inclut facebook.net et facebook.com', () => {
    const hosts = metaAdapter.cspHosts();
    expect(hosts.scriptSrc).toContain('https://connect.facebook.net');
    expect(hosts.connectSrc).toContain('https://www.facebook.com');
    expect(hosts.connectSrc).toContain('https://graph.facebook.com');
  });
});

// ─── Snap ────────────────────────────────────────────────────────────

describe('Snap client snippet', () => {
  it('retourne un snippet d\'init sans PAGE_VIEW auto-track', () => {
    const p = provider('snap', { pixelId: 'snap-pixel-uuid' });
    const snippet = snapAdapter.clientSnippet!(p);
    expect(snippet).not.toBeNull();
    expect(snippet!).toContain("snaptr('init','snap-pixel-uuid')");
    // CRITICAL: Snap snippet must NOT contain PAGE_VIEW auto-track
    // (CAPI sends it server-side, auto-track would cause double events)
    expect(snippet!).not.toContain("snaptr('track','PAGE_VIEW')");
    expect(snippet!).not.toContain('snaptr("track","PAGE_VIEW")');
  });

  it('retourne null si provider désactivé', () => {
    expect(snapAdapter.clientSnippet!(provider('snap', { status: 'disabled' }))).toBeNull();
  });

  it('retourne null si pixelId manquant', () => {
    expect(snapAdapter.clientSnippet!(provider('snap', { pixelId: null }))).toBeNull();
  });

  it('CSP hosts inclut sc-static.net et tr.snapchat.com', () => {
    const hosts = snapAdapter.cspHosts();
    expect(hosts.scriptSrc).toContain('https://sc-static.net');
    expect(hosts.connectSrc).toContain('https://tr.snapchat.com');
  });
});

// ─── TikTok ──────────────────────────────────────────────────────────

describe('TikTok client snippet', () => {
  it('retourne un snippet avec ttq.load et ttq.page', () => {
    const p = provider('tiktok', { pixelId: 'tiktok-pixel-id' });
    const snippet = tiktokAdapter.clientSnippet!(p);
    expect(snippet).not.toBeNull();
    expect(snippet!).toContain("ttq.load('tiktok-pixel-id')");
    expect(snippet!).toContain('ttq.page()');
  });

  it('retourne null si provider désactivé', () => {
    expect(tiktokAdapter.clientSnippet!(provider('tiktok', { status: 'disabled' }))).toBeNull();
  });

  it('retourne null si pixelId manquant', () => {
    expect(tiktokAdapter.clientSnippet!(provider('tiktok', { pixelId: null }))).toBeNull();
  });

  it('CSP hosts inclut analytics.tiktok.com et business-api.tiktok.com', () => {
    const hosts = tiktokAdapter.cspHosts();
    expect(hosts.scriptSrc).toContain('https://analytics.tiktok.com');
    expect(hosts.connectSrc).toContain('https://analytics.tiktok.com');
    expect(hosts.connectSrc).toContain('https://business-api.tiktok.com');
  });
});

// ─── Pinterest ───────────────────────────────────────────────────────

describe('Pinterest client snippet', () => {
  it('retourne un snippet avec pintrk load et page', () => {
    const p = provider('pinterest', { pixelId: 'pinterest-tag-id' });
    const snippet = pinterestAdapter.clientSnippet!(p);
    expect(snippet).not.toBeNull();
    expect(snippet!).toContain("pintrk('load','pinterest-tag-id')");
    expect(snippet!).toContain("pintrk('page')");
  });

  it('utilise config.tag_id si présent', () => {
    const p = provider('pinterest', {
      pixelId: 'ad-account-123',
      config: { tag_id: 'tag-override-456' },
    });
    const snippet = pinterestAdapter.clientSnippet!(p);
    expect(snippet!).toContain("pintrk('load','tag-override-456')");
  });

  it('retourne null si provider désactivé', () => {
    expect(pinterestAdapter.clientSnippet!(provider('pinterest', { status: 'disabled' }))).toBeNull();
  });

  it('retourne null si pixelId manquant', () => {
    expect(pinterestAdapter.clientSnippet!(provider('pinterest', { pixelId: null }))).toBeNull();
  });

  it('CSP hosts inclut s.pinimg.com et ct.pinterest.com', () => {
    const hosts = pinterestAdapter.cspHosts();
    expect(hosts.scriptSrc).toContain('https://s.pinimg.com');
    expect(hosts.connectSrc).toContain('https://ct.pinterest.com');
    expect(hosts.connectSrc).toContain('https://api.pinterest.com');
  });
});

// ─── Google Ads (client-only via GTM) ────────────────────────────────

describe('Google Ads client snippet', () => {
  it('retourne null (géré via GTM uniquement)', () => {
    expect(googleAdsAdapter.clientSnippet!(provider('google_ads'))).toBeNull();
  });

  it('CSP hosts inclut googletagmanager.com et googleadservices.com', () => {
    const hosts = googleAdsAdapter.cspHosts();
    expect(hosts.scriptSrc).toContain('https://www.googletagmanager.com');
    expect(hosts.scriptSrc).toContain('https://www.googleadservices.com');
    expect(hosts.connectSrc).toContain('https://www.google.com');
    expect(hosts.connectSrc).toContain('https://googleads.g.doubleclick.net');
  });

  it('supports retourne toujours false (client-only)', () => {
    expect(googleAdsAdapter.supports('purchase')).toBe(false);
    expect(googleAdsAdapter.supports('page_view')).toBe(false);
  });
});

// ─── GTM ─────────────────────────────────────────────────────────────

describe('GTM client snippet', () => {
  it('retourne null (injecté via root layout)', () => {
    expect(gtmAdapter.clientSnippet!(provider('gtm'))).toBeNull();
  });

  it('supports retourne toujours true (route tout)', () => {
    expect(gtmAdapter.supports('purchase')).toBe(true);
    expect(gtmAdapter.supports('page_view')).toBe(true);
    expect(gtmAdapter.supports('unknown_event')).toBe(true);
  });
});

// ─── Google GA4 ──────────────────────────────────────────────────────

describe('Google GA4 client snippet', () => {
  it('retourne null (géré via GTM)', () => {
    expect(googleAdapter.clientSnippet!(provider('google_ga4'))).toBeNull();
  });

  it('CSP hosts inclut www.googletagmanager.com et google-analytics.com', () => {
    const hosts = googleAdapter.cspHosts();
    expect(hosts.scriptSrc).toContain('https://www.googletagmanager.com');
    expect(hosts.connectSrc).toContain('https://www.google-analytics.com');
  });
});

// ─── Cross-provider dedup verification ───────────────────────────────

describe('client-snippet dedup: pas de double PAGE_VIEW entre client et serveur', () => {
  it('Snap n\'envoie PAS PAGE_VIEW côté client (CAPI s\'en charge)', () => {
    const p = provider('snap', { pixelId: 'snap-px' });
    const snippet = snapAdapter.clientSnippet!(p);
    // Le snippet doit contenir snaptr('init',...) mais PAS snaptr('track','PAGE_VIEW')
    expect(snippet).toContain("snaptr('init'");
    expect(snippet).not.toContain("PAGE_VIEW");
  });

  it('Meta envoie PageView côté client (standard Meta pixel)', () => {
    const p = provider('meta', { pixelId: 'meta-px' });
    const snippet = metaAdapter.clientSnippet!(p);
    // Meta envoie PageView côté client car c'est le standard du pixel Meta
    expect(snippet).toContain("fbq('track','PageView')");
  });

  it('TikTok envoie ttq.page() côté client (standard TikTok pixel)', () => {
    const p = provider('tiktok', { pixelId: 'tiktok-px' });
    const snippet = tiktokAdapter.clientSnippet!(p);
    expect(snippet).toContain('ttq.page()');
  });

  it('Pinterest envoie pintrk(\'page\') côté client (standard Pinterest tag)', () => {
    const p = provider('pinterest', { pixelId: 'pin-px' });
    const snippet = pinterestAdapter.clientSnippet!(p);
    expect(snippet).toContain("pintrk('page')");
  });
});