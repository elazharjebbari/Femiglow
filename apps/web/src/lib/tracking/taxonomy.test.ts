import { describe, expect, it } from 'vitest';

import {
  BUCKET_LABELS,
  TRAFFIC_BUCKETS,
  classifyTraffic,
} from './taxonomy';

describe('TRAFFIC_BUCKETS énumération', () => {
  it('contient les 14 buckets stables', () => {
    expect(TRAFFIC_BUCKETS).toHaveLength(14);
  });

  it('chaque bucket a un label FR', () => {
    for (const bucket of TRAFFIC_BUCKETS) {
      expect(BUCKET_LABELS[bucket]).toBeTruthy();
      expect(BUCKET_LABELS[bucket].length).toBeGreaterThan(0);
    }
  });

  it('inclut direct, organic_search, paid_search, organic_social, paid_social, email', () => {
    expect(TRAFFIC_BUCKETS).toContain('direct');
    expect(TRAFFIC_BUCKETS).toContain('organic_search');
    expect(TRAFFIC_BUCKETS).toContain('paid_search');
    expect(TRAFFIC_BUCKETS).toContain('organic_social');
    expect(TRAFFIC_BUCKETS).toContain('paid_social');
    expect(TRAFFIC_BUCKETS).toContain('email');
  });
});

describe('classifyTraffic — Click IDs (priorité 1)', () => {
  it('gclid → paid_search google', () => {
    const r = classifyTraffic({ clickIds: { gclid: 'ABC123' } });
    expect(r.bucket).toBe('paid_search');
    expect(r.source).toBe('google');
    expect(r.medium).toBe('cpc');
    expect(r.isPaid).toBe(true);
    expect(r.confidence).toBe('high');
  });

  it('gbraid → paid_search google (variante)', () => {
    const r = classifyTraffic({ clickIds: { gbraid: 'XYZ' } });
    expect(r.bucket).toBe('paid_search');
    expect(r.source).toBe('google');
  });

  it('wbraid → paid_search google (variante)', () => {
    const r = classifyTraffic({ clickIds: { wbraid: 'XYZ' } });
    expect(r.bucket).toBe('paid_search');
    expect(r.source).toBe('google');
  });

  it('msclkid → paid_search bing', () => {
    const r = classifyTraffic({ clickIds: { msclkid: 'BING123' } });
    expect(r.bucket).toBe('paid_search');
    expect(r.source).toBe('bing');
  });

  it('fbclid → paid_social meta', () => {
    const r = classifyTraffic({ clickIds: { fbclid: 'FB456' } });
    expect(r.bucket).toBe('paid_social');
    expect(r.source).toBe('meta');
    expect(r.isPaid).toBe(true);
  });

  it('ttclid → paid_social tiktok', () => {
    const r = classifyTraffic({ clickIds: { ttclid: 'TT789' } });
    expect(r.bucket).toBe('paid_social');
    expect(r.source).toBe('tiktok');
  });

  it('sccid → paid_social snapchat', () => {
    const r = classifyTraffic({ clickIds: { sccid: 'SNAP' } });
    expect(r.bucket).toBe('paid_social');
    expect(r.source).toBe('snapchat');
  });

  it('epik → paid_social pinterest', () => {
    const r = classifyTraffic({ clickIds: { epik: 'PIN' } });
    expect(r.bucket).toBe('paid_social');
    expect(r.source).toBe('pinterest');
  });

  it('click ID + UTM campaign : la campagne est conservée', () => {
    const r = classifyTraffic({
      clickIds: { gclid: 'A' },
      utm: { campaign: 'spring-sale' },
    });
    expect(r.bucket).toBe('paid_search');
    expect(r.campaign).toBe('spring-sale');
  });

  it('click ID override UTM (priorité)', () => {
    // Même si UTM dit "organic", le click ID gclid impose paid_search
    const r = classifyTraffic({
      clickIds: { gclid: 'A' },
      utm: { source: 'google', medium: 'organic' },
    });
    expect(r.bucket).toBe('paid_search');
    expect(r.isPaid).toBe(true);
  });
});

describe('classifyTraffic — UTM (priorité 2)', () => {
  it('utm_medium=cpc → paid_search', () => {
    const r = classifyTraffic({
      utm: { source: 'google', medium: 'cpc' },
    });
    expect(r.bucket).toBe('paid_search');
    expect(r.source).toBe('google');
    expect(r.medium).toBe('cpc');
  });

  it('utm_medium=ppc → paid_search', () => {
    const r = classifyTraffic({ utm: { source: 'google', medium: 'ppc' } });
    expect(r.bucket).toBe('paid_search');
  });

  it('utm_medium=paid_social + source=facebook → paid_social', () => {
    const r = classifyTraffic({
      utm: { source: 'facebook', medium: 'paid_social' },
    });
    expect(r.bucket).toBe('paid_social');
  });

  it('utm_medium=organic + source=google → organic_search', () => {
    const r = classifyTraffic({
      utm: { source: 'google', medium: 'organic' },
    });
    expect(r.bucket).toBe('organic_search');
  });

  it('utm_medium=organic + source=facebook → organic_social', () => {
    const r = classifyTraffic({
      utm: { source: 'facebook', medium: 'organic' },
    });
    expect(r.bucket).toBe('organic_social');
  });

  it('utm_medium=social + source=tiktok → organic_social', () => {
    const r = classifyTraffic({
      utm: { source: 'tiktok', medium: 'social' },
    });
    expect(r.bucket).toBe('organic_social');
  });

  it('utm_medium=email → email', () => {
    const r = classifyTraffic({
      utm: { source: 'newsletter', medium: 'email' },
    });
    expect(r.bucket).toBe('email');
  });

  it('utm_medium=newsletter → email', () => {
    const r = classifyTraffic({
      utm: { source: 'klaviyo', medium: 'newsletter' },
    });
    expect(r.bucket).toBe('email');
  });

  it('utm_medium=affiliate → affiliate', () => {
    const r = classifyTraffic({
      utm: { source: 'partner', medium: 'affiliate' },
    });
    expect(r.bucket).toBe('affiliate');
  });

  it('utm_medium=display → display', () => {
    const r = classifyTraffic({
      utm: { source: 'admob', medium: 'display' },
    });
    expect(r.bucket).toBe('display');
  });

  it('utm_medium=banner → display', () => {
    const r = classifyTraffic({
      utm: { source: 'partner', medium: 'banner' },
    });
    expect(r.bucket).toBe('display');
  });

  it('utm_medium=video → video', () => {
    const r = classifyTraffic({
      utm: { source: 'youtube', medium: 'video' },
    });
    expect(r.bucket).toBe('video');
  });

  it('utm_medium=sms → sms', () => {
    const r = classifyTraffic({
      utm: { source: 'twilio', medium: 'sms' },
    });
    expect(r.bucket).toBe('sms');
  });

  it('utm_medium=qrcode → qr', () => {
    const r = classifyTraffic({
      utm: { source: 'instore', medium: 'qrcode' },
    });
    expect(r.bucket).toBe('qr');
  });

  it('utm_medium=internal → internal', () => {
    const r = classifyTraffic({
      utm: { source: 'admin', medium: 'internal' },
    });
    expect(r.bucket).toBe('internal');
  });

  it('source=meta sans medium → organic_social (heuristique source)', () => {
    const r = classifyTraffic({ utm: { source: 'meta' } });
    expect(r.bucket).toBe('organic_social');
  });

  it('source=google_ads sans medium → paid_search', () => {
    const r = classifyTraffic({ utm: { source: 'google_ads' } });
    expect(r.bucket).toBe('paid_search');
  });

  it('utm_medium inconnu + source inconnu → referral (fallback UTM)', () => {
    const r = classifyTraffic({
      utm: { source: 'partner-x', medium: 'collab' },
    });
    expect(r.bucket).toBe('referral');
  });

  it('campaign propagée dans le résultat', () => {
    const r = classifyTraffic({
      utm: { source: 'meta', medium: 'cpc', campaign: 'spring-2026' },
    });
    expect(r.campaign).toBe('spring-2026');
  });
});

describe('classifyTraffic — Referrer (priorité 3)', () => {
  it('google.com referrer → organic_search', () => {
    const r = classifyTraffic({ referrer: 'https://www.google.com/search?q=femiglow' });
    expect(r.bucket).toBe('organic_search');
    expect(r.source).toBe('google');
    expect(r.confidence).toBe('medium');
  });

  it('google.fr referrer → organic_search', () => {
    const r = classifyTraffic({ referrer: 'https://www.google.fr/' });
    expect(r.bucket).toBe('organic_search');
    expect(r.source).toBe('google');
  });

  it('bing.com referrer → organic_search', () => {
    const r = classifyTraffic({ referrer: 'https://www.bing.com/search' });
    expect(r.bucket).toBe('organic_search');
    expect(r.source).toBe('bing');
  });

  it('duckduckgo.com referrer → organic_search', () => {
    const r = classifyTraffic({ referrer: 'https://duckduckgo.com/' });
    expect(r.bucket).toBe('organic_search');
    expect(r.source).toBe('duckduckgo');
  });

  it('instagram.com referrer → organic_social', () => {
    const r = classifyTraffic({ referrer: 'https://www.instagram.com/' });
    expect(r.bucket).toBe('organic_social');
    expect(r.source).toBe('instagram');
  });

  it('tiktok.com referrer → organic_social', () => {
    const r = classifyTraffic({ referrer: 'https://www.tiktok.com/@user' });
    expect(r.bucket).toBe('organic_social');
    expect(r.source).toBe('tiktok');
  });

  it('facebook.com referrer → organic_social', () => {
    const r = classifyTraffic({ referrer: 'https://www.facebook.com/' });
    expect(r.bucket).toBe('organic_social');
    expect(r.source).toBe('facebook');
  });

  it('m.facebook.com referrer → organic_social', () => {
    const r = classifyTraffic({ referrer: 'https://m.facebook.com/' });
    expect(r.bucket).toBe('organic_social');
    expect(r.source).toBe('facebook');
  });

  it('youtube.com referrer → video', () => {
    const r = classifyTraffic({ referrer: 'https://www.youtube.com/watch?v=xyz' });
    expect(r.bucket).toBe('video');
    expect(r.source).toBe('youtube');
  });

  it('referrer inconnu → referral avec hostname', () => {
    const r = classifyTraffic({ referrer: 'https://partner-shop.com/blog' });
    expect(r.bucket).toBe('referral');
    expect(r.source).toBe('partner-shop.com');
    expect(r.confidence).toBe('low');
  });

  it('referrer URL invalide → fallback direct (pas de crash)', () => {
    const r = classifyTraffic({ referrer: 'not-a-url' });
    expect(r.bucket).toBe('direct');
  });
});

describe('classifyTraffic — Fallback direct', () => {
  it('aucun signal → direct', () => {
    const r = classifyTraffic({});
    expect(r.bucket).toBe('direct');
    expect(r.source).toBe('direct');
    expect(r.medium).toBe('none');
    expect(r.isPaid).toBe(false);
  });

  it('signals tous null → direct', () => {
    const r = classifyTraffic({
      utm: { source: null, medium: null, campaign: null },
      clickIds: { gclid: null, fbclid: null },
      referrer: null,
    });
    expect(r.bucket).toBe('direct');
  });

  it('UTM strings vides → direct (pas vu comme signal)', () => {
    const r = classifyTraffic({ utm: { source: '', medium: '' } });
    expect(r.bucket).toBe('direct');
  });
});

describe('classifyTraffic — Pureté & déterminisme', () => {
  it('même input → même output', () => {
    const input = { utm: { source: 'meta', medium: 'cpc' } };
    expect(classifyTraffic(input)).toEqual(classifyTraffic(input));
  });

  it('ne mute pas l\'input', () => {
    const input = { utm: { source: 'meta', medium: 'cpc' } };
    const snapshot = JSON.stringify(input);
    classifyTraffic(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
