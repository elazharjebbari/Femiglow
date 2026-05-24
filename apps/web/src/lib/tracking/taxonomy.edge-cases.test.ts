/**
 * Tests `classifyTraffic` — cas extrêmes & robustesse.
 *
 * Complète `taxonomy.test.ts` avec les cas qui ont historiquement
 * causé des bugs de classification dans des systèmes similaires :
 *  - UTM URL-encoded
 *  - Casse mixte
 *  - Referrer avec ports / sous-domaines exotiques
 *  - Conflits sémantiques (gclid + utm_medium=organic incohérent)
 *  - Inputs trim+normaliser
 *  - Performance / pureté
 *
 * Référence : `docs/attribution-fix-2026-05/04-tests-strategy.md`.
 */
import { describe, expect, it } from 'vitest';

import { classifyTraffic, bucketFromAttributionChannel } from './taxonomy';

describe('classifyTraffic — UTM URL-encoded', () => {
  it('utm_source décodé manuellement (cas legacy parsing client)', () => {
    // Si l'amont passe la valeur déjà décodée
    const r = classifyTraffic({
      utm: { source: 'meta ads', medium: 'cpc' },
    });
    expect(r.bucket).toBe('paid_search');
    // Note: "meta ads" en source ne matche pas la heuristique isSocialSource
    // (qui cherche "meta" strictement). Le medium=cpc gagne → paid_search.
    // Pour la prod : recommander que le middleware decode AVANT de set cookie.
  });

  it('valeurs avec espaces accidentels — pas de trim côté lib', () => {
    // classifyTraffic ne fait pas de trim — c'est volontaire (single
    // responsibility). C'est à l'amont (middleware/client) de normaliser.
    const r = classifyTraffic({
      utm: { source: '  meta  ', medium: 'cpc' },
    });
    // ' meta ' ne matche pas isSocialSource (strict equality dans la liste)
    // mais medium=cpc gagne et bucket = paid_search
    expect(r.bucket).toBe('paid_search');
  });
});

describe('classifyTraffic — Casse', () => {
  it('utm_medium=CPC majuscules → normalisation interne (lower)', () => {
    const r = classifyTraffic({
      utm: { source: 'meta', medium: 'CPC' },
    });
    // Le code applique .toLowerCase() en interne → 'cpc' → paid_search
    expect(r.bucket).toBe('paid_search');
  });

  it('utm_source=META en majuscules + medium social → organic_social', () => {
    const r = classifyTraffic({
      utm: { source: 'META', medium: 'social' },
    });
    expect(r.bucket).toBe('organic_social');
  });

  it('referrer scheme http (non https) → classifié correctement', () => {
    const r = classifyTraffic({
      referrer: 'http://www.google.com/search?q=femiglow',
    });
    expect(r.bucket).toBe('organic_search');
    expect(r.source).toBe('google');
  });
});

describe('classifyTraffic — Conflits sémantiques', () => {
  it('gclid + utm_medium=organic incohérent → gclid PRIORITAIRE', () => {
    // Cas concret : gclid présent mais campagne mal taggée
    const r = classifyTraffic({
      clickIds: { gclid: 'A' },
      utm: { source: 'google', medium: 'organic' },
    });
    expect(r.bucket).toBe('paid_search');
    expect(r.isPaid).toBe(true);
  });

  it('fbclid + referrer=google → fbclid PRIORITAIRE (paid_social)', () => {
    // Cas concret : utilisateur ouvre lien Meta ad dans nouvel onglet
    // depuis SERP Google → referrer Google mais click ID Meta
    const r = classifyTraffic({
      clickIds: { fbclid: 'FB' },
      referrer: 'https://www.google.com/',
    });
    expect(r.bucket).toBe('paid_social');
    expect(r.source).toBe('meta');
  });

  it('plusieurs click IDs simultanés → premier dans l\'ordre de priorité', () => {
    const r = classifyTraffic({
      clickIds: { gclid: 'G', fbclid: 'F', ttclid: 'T' },
    });
    // gclid d'abord (Google), puis msclkid (Bing), puis fbclid (Meta)…
    expect(r.bucket).toBe('paid_search');
    expect(r.source).toBe('google');
  });

  it('UTM avec source TikTok + medium organic + click ttclid → paid_social', () => {
    // ttclid trumps tout
    const r = classifyTraffic({
      clickIds: { ttclid: 'T' },
      utm: { source: 'tiktok', medium: 'organic' },
    });
    expect(r.bucket).toBe('paid_social');
    expect(r.isPaid).toBe(true);
  });
});

describe('classifyTraffic — Referrers exotiques', () => {
  it('referrer avec port → ignore le port', () => {
    const r = classifyTraffic({
      referrer: 'https://www.google.com:443/search?q=x',
    });
    expect(r.bucket).toBe('organic_search');
  });

  it('referrer hostname avec sous-domaines multiples', () => {
    const r = classifyTraffic({
      referrer: 'https://l.instagram.com/?u=https%3A//femiglow.com',
    });
    // l.instagram.com endsWith ".instagram.com" → organic_social
    expect(r.bucket).toBe('organic_social');
    expect(r.source).toBe('instagram');
  });

  it('referrer avec credentials et path complexe', () => {
    const r = classifyTraffic({
      referrer: 'https://user:pass@tiktok.com/path?q=1#hash',
    });
    expect(r.bucket).toBe('organic_social');
    expect(r.source).toBe('tiktok');
  });

  it('referrer protocole-relative // → traité comme URL invalide → direct', () => {
    const r = classifyTraffic({
      referrer: '//google.com/',
    });
    expect(r.bucket).toBe('direct');
  });

  it('referrer chaîne vide → direct', () => {
    const r = classifyTraffic({ referrer: '' });
    expect(r.bucket).toBe('direct');
  });

  it('referrer = own site → considered referral (sans normalisation own-site)', () => {
    // À noter : classifyTraffic ne sait pas que c'est "own site". L'amont
    // doit filter avant si besoin (cf. Plausible "exclude internal").
    const r = classifyTraffic({
      referrer: 'https://femiglow-maroc.com/journal/x',
    });
    expect(r.bucket).toBe('referral');
    expect(r.source).toBe('femiglow-maroc.com');
  });
});

describe('classifyTraffic — Source-driven heuristics', () => {
  it('utm_source=facebook sans medium → organic_social', () => {
    const r = classifyTraffic({ utm: { source: 'facebook' } });
    expect(r.bucket).toBe('organic_social');
  });

  it('utm_source=instagram sans medium → organic_social', () => {
    const r = classifyTraffic({ utm: { source: 'instagram' } });
    expect(r.bucket).toBe('organic_social');
  });

  it('utm_source=tiktok sans medium → organic_social', () => {
    const r = classifyTraffic({ utm: { source: 'tiktok' } });
    expect(r.bucket).toBe('organic_social');
  });

  it('utm_source=bingads sans medium → paid_search', () => {
    const r = classifyTraffic({ utm: { source: 'bingads' } });
    expect(r.bucket).toBe('paid_search');
  });

  it('utm_source=adwords sans medium → paid_search', () => {
    const r = classifyTraffic({ utm: { source: 'adwords' } });
    expect(r.bucket).toBe('paid_search');
  });

  it('utm_source=partner-x sans medium → referral (fallback)', () => {
    const r = classifyTraffic({ utm: { source: 'partner-x' } });
    expect(r.bucket).toBe('referral');
  });
});

describe('classifyTraffic — Confidence levels', () => {
  it('click ID → confidence high', () => {
    const r = classifyTraffic({ clickIds: { gclid: 'A' } });
    expect(r.confidence).toBe('high');
  });

  it('UTM → confidence high', () => {
    const r = classifyTraffic({ utm: { source: 's', medium: 'cpc' } });
    expect(r.confidence).toBe('high');
  });

  it('referrer connu → confidence medium', () => {
    const r = classifyTraffic({ referrer: 'https://google.com/' });
    expect(r.confidence).toBe('medium');
  });

  it('referrer inconnu → confidence low', () => {
    const r = classifyTraffic({ referrer: 'https://random-site.io/' });
    expect(r.confidence).toBe('low');
  });

  it('direct fallback → confidence high (déterministe)', () => {
    const r = classifyTraffic({});
    expect(r.confidence).toBe('high');
  });
});

describe('classifyTraffic — Performance & purity', () => {
  it('1000 appels avec mêmes inputs → < 50ms (perf sanity)', () => {
    const input = {
      utm: { source: 'meta', medium: 'cpc', campaign: 'spring' },
      clickIds: { fbclid: 'A' },
      referrer: 'https://www.facebook.com/',
    };
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      classifyTraffic(input);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('ne mute jamais l\'input (immutability strict)', () => {
    const input = {
      utm: { source: 'meta', medium: 'cpc', campaign: 'spring' },
      clickIds: { fbclid: 'A' },
      referrer: 'https://www.facebook.com/',
    };
    const snapshot = JSON.stringify(input);
    classifyTraffic(input);
    classifyTraffic(input);
    classifyTraffic(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('bucketFromAttributionChannel — interop legacy', () => {
  it('google_ads + isPaid=true → paid_search', () => {
    expect(bucketFromAttributionChannel('google_ads', true)).toBe('paid_search');
  });

  it('meta + isPaid=true → paid_social', () => {
    expect(bucketFromAttributionChannel('meta', true)).toBe('paid_social');
  });

  it('tiktok + isPaid=true → paid_social', () => {
    expect(bucketFromAttributionChannel('tiktok', true)).toBe('paid_social');
  });

  it('snap + isPaid=true → paid_social', () => {
    expect(bucketFromAttributionChannel('snap', true)).toBe('paid_social');
  });

  it('pinterest + isPaid=true → paid_social', () => {
    expect(bucketFromAttributionChannel('pinterest', true)).toBe('paid_social');
  });

  it('bing_ads + isPaid=true → paid_search', () => {
    expect(bucketFromAttributionChannel('bing_ads', true)).toBe('paid_search');
  });

  it('email → email (paid status ignoré)', () => {
    expect(bucketFromAttributionChannel('email', false)).toBe('email');
    expect(bucketFromAttributionChannel('email', true)).toBe('email');
  });

  it('social_organic → organic_social', () => {
    expect(bucketFromAttributionChannel('social_organic', false)).toBe('organic_social');
  });

  it('organic → organic_search (par défaut)', () => {
    expect(bucketFromAttributionChannel('organic', false)).toBe('organic_search');
  });

  it('direct → direct', () => {
    expect(bucketFromAttributionChannel('direct', false)).toBe('direct');
  });

  it('broadcast → unknown', () => {
    expect(bucketFromAttributionChannel('broadcast', false)).toBe('unknown');
  });

  it('canal inconnu → unknown (failsafe)', () => {
    expect(bucketFromAttributionChannel('something-new', false)).toBe('unknown');
  });

  it('meta isPaid=false → unknown (organic Meta sans signal)', () => {
    // Cohérent : on n'a pas assez d'info pour distinguer organic vs paid
    expect(bucketFromAttributionChannel('meta', false)).toBe('unknown');
  });
});
