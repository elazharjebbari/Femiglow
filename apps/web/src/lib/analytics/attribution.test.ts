import { describe, expect, it } from 'vitest';
import { classifyTraffic, isTrafficBucket, TRAFFIC_BUCKETS } from './attribution';

describe('classifyTraffic — utm_source priorité 1', () => {
  it.each([
    ['google', 'google'],
    ['Google', 'google'],
    ['google_cpc', 'google'],
    ['google-ads', 'google'],
    ['bing', 'bing'],
    ['duckduckgo', 'duckduckgo'],
    ['facebook', 'meta'],
    ['instagram', 'meta'],
    ['fb', 'meta'],
    ['meta', 'meta'],
    ['tiktok', 'tiktok'],
    ['snap', 'snap'],
    ['snapchat', 'snap'],
    ['pinterest', 'pinterest'],
    ['twitter', 'twitter'],
    ['x', 'twitter'],
    ['linkedin', 'linkedin'],
    ['youtube', 'youtube'],
  ])('utm_source=%s → %s', (utmSource, expected) => {
    expect(classifyTraffic({ utm: { utm_source: utmSource } }).source).toBe(expected);
  });

  it('utm_source inconnu → other', () => {
    expect(classifyTraffic({ utm: { utm_source: 'mystery_partner_42' } }).source).toBe('other');
  });

  it('priorise utm_source sur referrer', () => {
    expect(
      classifyTraffic({ utm: { utm_source: 'meta' }, referrer: 'https://google.com/search' }).source,
    ).toBe('meta');
  });

  it('garde utm_medium même si bucket vient de utm_source', () => {
    const r = classifyTraffic({ utm: { utm_source: 'google', utm_medium: 'cpc' } });
    expect(r.source).toBe('google');
    expect(r.medium).toBe('cpc');
  });
});

describe('classifyTraffic — utm_medium priorité 2 (email/affiliate)', () => {
  it.each([
    ['email', 'email'],
    ['EMAIL', 'email'],
    ['newsletter', 'email'],
    ['affiliate', 'affiliate'],
    ['affiliates', 'affiliate'],
    ['partner', 'affiliate'],
    ['partners', 'affiliate'],
  ])('utm_medium=%s → %s', (medium, expected) => {
    expect(classifyTraffic({ utm: { utm_medium: medium } }).source).toBe(expected);
  });

  it('utm_medium=cpc sans source → fallback referrer', () => {
    const r = classifyTraffic({ utm: { utm_medium: 'cpc' } });
    expect(r.source).toBe('direct');
    expect(r.medium).toBe('cpc');
  });
});

describe('classifyTraffic — referrer priorité 4', () => {
  it.each([
    ['https://www.google.com/search?q=test', 'google'],
    ['https://google.fr/', 'google'],
    ['https://www.bing.com/', 'bing'],
    ['https://duckduckgo.com/', 'duckduckgo'],
    ['https://www.facebook.com/x', 'meta'],
    ['https://l.instagram.com/y', 'meta'],
    ['https://www.tiktok.com/', 'tiktok'],
    ['https://snapchat.com/', 'snap'],
    ['https://pinterest.fr/', 'pinterest'],
    ['https://t.co/abcd', 'twitter'],
    ['https://twitter.com/foo', 'twitter'],
    ['https://www.linkedin.com/', 'linkedin'],
    ['https://www.youtube.com/watch?v=z', 'youtube'],
    ['https://youtu.be/xyz', 'youtube'],
  ])('referrer=%s → %s', (ref, expected) => {
    expect(classifyTraffic({ referrer: ref }).source).toBe(expected);
  });

  it('referrer custom (autre site) → other', () => {
    expect(classifyTraffic({ referrer: 'https://news.example.com/article' }).source).toBe('other');
  });

  it('referrer vide → direct', () => {
    expect(classifyTraffic({ referrer: '' }).source).toBe('direct');
  });

  it('referrer non parseable → soit "direct" soit "other" mais ne crash pas', () => {
    // Selon l'environnement (jsdom vs node), certaines strings se parsent
    // comme URL "vides" et d'autres lèvent. Le contrat est : pas de crash.
    const r = classifyTraffic({ referrer: '\\\\bad uri' });
    expect(['direct', 'other']).toContain(r.source);
  });

  it('referrer null/undefined → direct', () => {
    expect(classifyTraffic({ referrer: null }).source).toBe('direct');
    expect(classifyTraffic({}).source).toBe('direct');
  });
});

describe('classifyTraffic — direct (priorité 5)', () => {
  it('aucun utm aucun referrer → direct', () => {
    expect(classifyTraffic({}).source).toBe('direct');
    expect(classifyTraffic({ utm: {}, referrer: null }).source).toBe('direct');
  });

  it('medium uniquement, sans match dictionnaire → fallback direct', () => {
    expect(classifyTraffic({ utm: { utm_medium: 'organic' } }).source).toBe('direct');
  });
});

describe('classifyTraffic — robustesse', () => {
  it('utm_source vide → ignoré', () => {
    expect(classifyTraffic({ utm: { utm_source: '   ' } }).source).toBe('direct');
  });

  it('strings avec espaces → trimmed', () => {
    expect(classifyTraffic({ utm: { utm_source: '  google  ' } }).source).toBe('google');
  });

  it('input null safety', () => {
    expect(classifyTraffic({ utm: null, referrer: null }).source).toBe('direct');
  });
});

describe('isTrafficBucket', () => {
  it('reconnait les buckets connus', () => {
    expect(isTrafficBucket('google')).toBe(true);
    expect(isTrafficBucket('meta')).toBe(true);
    expect(isTrafficBucket('direct')).toBe(true);
  });

  it('rejette les valeurs inconnues', () => {
    expect(isTrafficBucket('mystery')).toBe(false);
    expect(isTrafficBucket(null)).toBe(false);
    expect(isTrafficBucket(42)).toBe(false);
    expect(isTrafficBucket(undefined)).toBe(false);
  });
});

describe('TRAFFIC_BUCKETS', () => {
  it('contient 14 buckets stables', () => {
    expect(TRAFFIC_BUCKETS).toHaveLength(14);
    expect(TRAFFIC_BUCKETS).toContain('direct');
    expect(TRAFFIC_BUCKETS).toContain('other');
  });

  it('aucun doublon', () => {
    expect(new Set(TRAFFIC_BUCKETS).size).toBe(TRAFFIC_BUCKETS.length);
  });
});
