import { describe, expect, it } from 'vitest';
import {
  STANDARD_EVENTS_BY_KIND,
  getStandardEvents,
  isStandardEvent,
  findCloseStandardEvents,
} from './standard-events';

describe('STANDARD_EVENTS_BY_KIND — exhaustivité', () => {
  it('couvre les 6 providers du mapping', () => {
    expect(Object.keys(STANDARD_EVENTS_BY_KIND).sort()).toEqual([
      'google_ads', 'google_ga4', 'meta', 'pinterest', 'snap', 'tiktok',
    ]);
  });

  it('Meta contient les events clés (Purchase, Lead, ViewContent, …)', () => {
    const names = STANDARD_EVENTS_BY_KIND.meta.map((e) => e.name);
    for (const required of ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase', 'Lead', 'CompleteRegistration', 'Subscribe']) {
      expect(names).toContain(required);
    }
  });

  it('GA4 utilise snake_case strict', () => {
    for (const e of STANDARD_EVENTS_BY_KIND.google_ga4) {
      expect(e.name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('Meta utilise PascalCase ou CamelCase strict', () => {
    for (const e of STANDARD_EVENTS_BY_KIND.meta) {
      expect(e.name).toMatch(/^[A-Z][A-Za-z]*$/);
    }
  });

  it('Snap utilise UPPER_SNAKE_CASE', () => {
    for (const e of STANDARD_EVENTS_BY_KIND.snap) {
      expect(e.name).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('Pinterest utilise lowercase strict', () => {
    for (const e of STANDARD_EVENTS_BY_KIND.pinterest) {
      expect(e.name).toMatch(/^[a-z]+$/);
    }
  });

  it("STANDARD_EVENTS_BY_KIND est immutable (frozen)", () => {
    expect(Object.isFrozen(STANDARD_EVENTS_BY_KIND)).toBe(true);
  });

  it('chaque event a un name et un label non vides', () => {
    for (const kind of Object.keys(STANDARD_EVENTS_BY_KIND) as Array<keyof typeof STANDARD_EVENTS_BY_KIND>) {
      for (const e of STANDARD_EVENTS_BY_KIND[kind]) {
        expect(e.name.length).toBeGreaterThan(0);
        expect(e.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('chaque provider a au moins 8 events standards', () => {
    for (const kind of Object.keys(STANDARD_EVENTS_BY_KIND) as Array<keyof typeof STANDARD_EVENTS_BY_KIND>) {
      expect(STANDARD_EVENTS_BY_KIND[kind].length).toBeGreaterThanOrEqual(8);
    }
  });
});

describe('getStandardEvents', () => {
  it('retourne la liste pour Meta', () => {
    const events = getStandardEvents('meta');
    expect(events.length).toBeGreaterThan(10);
    expect(events[0]).toHaveProperty('name');
    expect(events[0]).toHaveProperty('label');
  });

  it('retourne la liste pour Google Ads', () => {
    expect(getStandardEvents('google_ads').length).toBeGreaterThan(0);
  });
});

describe('isStandardEvent', () => {
  it('reconnaît Meta Purchase comme standard', () => {
    expect(isStandardEvent('Purchase', 'meta')).toBe(true);
  });

  it('reconnaît GA4 purchase comme standard', () => {
    expect(isStandardEvent('purchase', 'google_ga4')).toBe(true);
  });

  it('reconnaît Snap PURCHASE comme standard', () => {
    expect(isStandardEvent('PURCHASE', 'snap')).toBe(true);
  });

  it("respecte strictement la casse", () => {
    // Meta = PascalCase ; 'purchase' (lowercase) n'est PAS un standard Meta
    expect(isStandardEvent('purchase', 'meta')).toBe(false);
    // GA4 = snake_case ; 'Purchase' (PascalCase) n'est PAS un standard GA4
    expect(isStandardEvent('Purchase', 'google_ga4')).toBe(false);
  });

  it('retourne false pour un nom inconnu', () => {
    expect(isStandardEvent('TotallyUnknownEvent', 'meta')).toBe(false);
    expect(isStandardEvent('checkout_intent', 'meta')).toBe(false); // event custom FemiGlow
  });

  it('retourne false pour name vide', () => {
    expect(isStandardEvent('', 'meta')).toBe(false);
  });

  it('retourne true pour les CUSTOM_EVENT_X de Snap', () => {
    expect(isStandardEvent('CUSTOM_EVENT_1', 'snap')).toBe(true);
    expect(isStandardEvent('CUSTOM_EVENT_5', 'snap')).toBe(true);
    expect(isStandardEvent('CUSTOM_EVENT_6', 'snap')).toBe(false);
  });
});

describe('findCloseStandardEvents', () => {
  it('matche par substring (case-insensitive)', () => {
    const matches = findCloseStandardEvents('purcha', 'meta');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.name).toBe('Purchase');
  });

  it('matche par label aussi', () => {
    const matches = findCloseStandardEvents('panier', 'meta');
    // 'AddToCart' a label 'Ajout panier' → match
    expect(matches.some((m) => m.name === 'AddToCart')).toBe(true);
  });

  it('respecte la limite', () => {
    const matches = findCloseStandardEvents('e', 'meta', 2);
    expect(matches.length).toBeLessThanOrEqual(2);
  });

  it('retourne [] pour name vide', () => {
    expect(findCloseStandardEvents('', 'meta')).toEqual([]);
  });

  it('retourne [] pour aucun match', () => {
    expect(findCloseStandardEvents('xyz_no_match_zzz', 'meta')).toEqual([]);
  });
});

describe('Coherence catalog ↔ event-mapping.ts (sanity)', () => {
  it('le mapping Purchase code legacy est bien un standard Meta', () => {
    // Si on retire 'Purchase' du catalog Meta par erreur, ce test casse
    expect(isStandardEvent('Purchase', 'meta')).toBe(true);
  });

  it("'checkout_intent' (custom event FemiGlow) n'est PAS standard Meta", () => {
    // Cet event est intentionnellement custom (D-004 tracking-improvement)
    expect(isStandardEvent('checkout_intent', 'meta')).toBe(false);
  });
});
