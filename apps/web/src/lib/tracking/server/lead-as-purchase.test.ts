import { beforeEach, describe, expect, it, vi } from 'vitest';

// Env mockable : on flippe le flag par test. `vi.hoisted` garantit que l'objet
// est initialisé AVANT la factory de `vi.mock` (hoistée en tête de module).
const mockEnv = vi.hoisted(() => ({
  META_LEAD_AS_PURCHASE_ENABLED: 'false' as 'true' | 'false',
  META_LEAD_PURCHASE_DEDUP_WINDOW_HOURS: 24,
}));
vi.mock('@/lib/env', () => ({ env: mockEnv }));

import {
  decideMetaForEvent,
  deriveMetaPurchaseJourneyId,
  hasRecentLeadAsPurchase,
  isEligibleLeadSource,
  recordLeadAsPurchase,
  __clearLeadAsPurchaseLedger,
} from './lead-as-purchase';

const T0 = 1_750_000_000_000; // base déterministe
const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  __clearLeadAsPurchaseLedger();
  mockEnv.META_LEAD_AS_PURCHASE_ENABLED = 'false';
  mockEnv.META_LEAD_PURCHASE_DEDUP_WINDOW_HOURS = 24;
});

describe('isEligibleLeadSource', () => {
  it('chat et abandoned_cart éligibles ; newsletter/contact non', () => {
    expect(isEligibleLeadSource('chat')).toBe(true);
    expect(isEligibleLeadSource('abandoned_cart')).toBe(true);
    expect(isEligibleLeadSource('newsletter')).toBe(false);
    expect(isEligibleLeadSource('contact')).toBe(false);
    expect(isEligibleLeadSource(undefined)).toBe(false);
  });
});

describe('deriveMetaPurchaseJourneyId', () => {
  it('même visiteur + même fenêtre → même id (lead et purchase confondus)', () => {
    const a = deriveMetaPurchaseJourneyId('v1', T0);
    const b = deriveMetaPurchaseJourneyId('v1', T0 + 5 * HOUR); // même bucket 24h
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });
  it('visiteurs différents → ids différents', () => {
    expect(deriveMetaPurchaseJourneyId('v1', T0)).not.toBe(deriveMetaPurchaseJourneyId('v2', T0));
  });
  it("hors fenêtre → id différent (laisse le ledger trancher)", () => {
    expect(deriveMetaPurchaseJourneyId('v1', T0)).not.toBe(
      deriveMetaPurchaseJourneyId('v1', T0 + 25 * HOUR),
    );
  });
});

describe('ledger record / hasRecent', () => {
  it('record puis hasRecent=true dans la fenêtre, false après expiration', () => {
    recordLeadAsPurchase('v1', T0);
    expect(hasRecentLeadAsPurchase('v1', T0 + HOUR)).toBe(true);
    expect(hasRecentLeadAsPurchase('v1', T0 + 25 * HOUR)).toBe(false); // > 24h
    expect(hasRecentLeadAsPurchase('v_autre', T0)).toBe(false);
  });
});

describe('decideMetaForEvent — flag OFF', () => {
  it('toujours passthrough (zéro impact)', () => {
    expect(decideMetaForEvent({ eventName: 'generate_lead', method: 'chat', visitorId: 'v1', now: T0 }))
      .toEqual({ action: 'passthrough' });
    expect(decideMetaForEvent({ eventName: 'purchase', visitorId: 'v1', now: T0 }))
      .toEqual({ action: 'passthrough' });
  });
});

describe('decideMetaForEvent — flag ON', () => {
  beforeEach(() => { mockEnv.META_LEAD_AS_PURCHASE_ENABLED = 'true'; });

  it('lead chat → as_purchase + journeyId + marque le ledger', () => {
    const d = decideMetaForEvent({ eventName: 'generate_lead', method: 'chat', visitorId: 'v1', now: T0 });
    expect(d.action).toBe('as_purchase');
    if (d.action === 'as_purchase') expect(d.journeyId).toBe(deriveMetaPurchaseJourneyId('v1', T0));
    expect(hasRecentLeadAsPurchase('v1', T0)).toBe(true);
  });

  it('lead panier abandonné → as_purchase', () => {
    expect(decideMetaForEvent({ eventName: 'generate_lead', method: 'abandoned_cart', visitorId: 'v2', now: T0 }).action)
      .toBe('as_purchase');
  });

  it('lead newsletter → passthrough (non éligible, pas de Meta Purchase)', () => {
    expect(decideMetaForEvent({ eventName: 'generate_lead', method: 'newsletter', visitorId: 'v3', now: T0 }))
      .toEqual({ action: 'passthrough' });
  });

  it('purchase APRÈS lead (même visiteur, fenêtre) → suppress', () => {
    decideMetaForEvent({ eventName: 'generate_lead', method: 'chat', visitorId: 'v1', now: T0 });
    const d = decideMetaForEvent({ eventName: 'purchase', visitorId: 'v1', now: T0 + 2 * HOUR });
    expect(d.action).toBe('suppress');
    if (d.action === 'suppress') expect(d.reason).toBe('lead_already_counted');
  });

  it('purchase SANS lead préalable → passthrough + journeyId (dédup Pixel↔CAPI)', () => {
    const d = decideMetaForEvent({ eventName: 'purchase', visitorId: 'v_solo', now: T0 });
    expect(d.action).toBe('passthrough');
    if (d.action === 'passthrough') expect(d.journeyId).toBe(deriveMetaPurchaseJourneyId('v_solo', T0));
  });

  it('purchase APRÈS lead mais HORS fenêtre → passthrough (nouveau parcours)', () => {
    decideMetaForEvent({ eventName: 'generate_lead', method: 'chat', visitorId: 'v1', now: T0 });
    const d = decideMetaForEvent({ eventName: 'purchase', visitorId: 'v1', now: T0 + 25 * HOUR });
    expect(d.action).toBe('passthrough');
  });
});
