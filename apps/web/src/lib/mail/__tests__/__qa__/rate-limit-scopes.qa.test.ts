/**
 * CHANTIER H — Module 08 : rate-limit des endpoints emailing par scope.
 * Test UNIT (memoryStore en mémoire, pas de vraie DB).
 *
 * Oracles : chaque scope a sa limite exacte ; au-delà → 429 + `Retry-After`
 * (secondes, > 0) ; les compteurs sont isolés par (scope, ip) ; la fenêtre se
 * réinitialise après `windowMs` (la requête suivante repasse).
 *
 * Pour PIP-INT-122 (reset de fenêtre), `enforceMailRateLimit` lit `Date.now()`
 * réel (pas d'injection) — on fait expirer le bucket en avançant son `resetAt`
 * dans le PASSÉ via le memoryStore (équivaut à « la fenêtre est écoulée »),
 * plutôt qu'un sleep.
 *
 * IDs matrice : PIP-INT-120, PIP-INT-121, PIP-INT-122, PIP-INT-123.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { memoryStore, resetMemoryStore } from '@/lib/db/client';
import { enforceMailRateLimit } from '../../rate-limit';

function req(ip: string): Request {
  return new Request('http://test/api/mail', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
  });
}

beforeEach(() => {
  resetMemoryStore();
});
afterEach(() => {
  resetMemoryStore();
});

describe('enforceMailRateLimit — limites par scope (Module 08)', () => {
  // PIP-INT-120 — scope unsubscribe : limite 60/min, la 61e → 429 + Retry-After.
  it('PIP-INT-120 — unsubscribe : 60 passent, 61e bloquée avec Retry-After', async () => {
    const r = req('203.0.113.10');
    for (let i = 0; i < 60; i++) {
      expect(await enforceMailRateLimit('unsubscribe', r)).toBeNull();
    }
    const blocked = await enforceMailRateLimit('unsubscribe', r);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    const retryAfter = Number(blocked!.headers.get('Retry-After'));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  // PIP-INT-121 — scope newsletter : limite 5/min, la 6e requête → 429.
  it('PIP-INT-121 — newsletter : 5 passent, 6e bloquée (429)', async () => {
    const r = req('203.0.113.11');
    for (let i = 0; i < 5; i++) {
      expect(await enforceMailRateLimit('newsletter', r)).toBeNull();
    }
    const blocked = await enforceMailRateLimit('newsletter', r);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
  });

  // PIP-INT-122 — reset de fenêtre : une fois la fenêtre écoulée, la requête
  // suivante repasse (nouveau bucket). On force l'écoulement en plaçant le
  // `resetAt` du bucket dans le passé (pas de sleep).
  it('PIP-INT-122 — après la fenêtre écoulée, le scope ré-autorise', async () => {
    const r = req('203.0.113.12');
    // Épuise newsletter (5).
    for (let i = 0; i < 5; i++) await enforceMailRateLimit('newsletter', r);
    expect((await enforceMailRateLimit('newsletter', r))!.status).toBe(429);

    // Simule la fenêtre écoulée : on antidate le resetAt du bucket concerné.
    const store = memoryStore();
    for (const [key, bucket] of store.rateLimitCounters) {
      if (key.startsWith('mail:newsletter:')) {
        store.rateLimitCounters.set(key, { ...bucket, resetAt: Date.now() - 1 });
      }
    }

    // La fenêtre est écoulée → la requête suivante repasse (bucket réinitialisé).
    expect(await enforceMailRateLimit('newsletter', r)).toBeNull();
  });

  // PIP-INT-123 — la clé (scope, ip) isole les compteurs : deux IP distinctes
  // ont des budgets indépendants. On épuise IP-A, IP-B passe encore.
  it('PIP-INT-123 — compteurs isolés par (scope, ip) : deux IP indépendantes', async () => {
    const a = req('203.0.113.20');
    const b = req('203.0.113.21');
    for (let i = 0; i < 5; i++) await enforceMailRateLimit('newsletter', a);
    expect((await enforceMailRateLimit('newsletter', a))!.status).toBe(429); // A épuisée
    expect(await enforceMailRateLimit('newsletter', b)).toBeNull(); // B intacte
  });

  // Volet « scope isolé » complémentaire : épuiser un scope n'affecte pas un
  // autre scope pour la même IP (clé = scope+ip).
  it('épuiser newsletter n affecte pas unsubscribe pour la même IP', async () => {
    const r = req('203.0.113.30');
    for (let i = 0; i < 5; i++) await enforceMailRateLimit('newsletter', r);
    expect((await enforceMailRateLimit('newsletter', r))!.status).toBe(429);
    // unsubscribe (scope différent) reste ouvert.
    expect(await enforceMailRateLimit('unsubscribe', r)).toBeNull();
  });
});
