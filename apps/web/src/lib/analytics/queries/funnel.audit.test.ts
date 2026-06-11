/**
 * SPEC APRÈS-FIX — onglet Funnel principal (findings AN-02 + AN-06).
 *
 * Audit : docs/analytics-audit-2026-06-04/. Le fix a remplacé le funnel
 * cumulatif STRICT (engage=view&&engage…, qui s'effondrait dès qu'une étape
 * intermédiaire était vide) par un modèle MONOTONIC (le jalon le plus avancé
 * implique les précédents), et élargi `classifyStage` :
 *   - checkout = begin_checkout / checkout_intent / add_shipping_info /
 *     address_completed / add_payment_info ;
 *   - purchase = purchase OR generate_lead (sémantique COD).
 *
 * Sur le dataset réaliste prod (view_item partout, begin_checkout multi-sessions,
 * purchase, generate_lead — SANS engage/cta_impression), les étapes aval sont
 * désormais comptées correctement.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';

import { getFunnelOverview } from './funnel';
import { AUDIT_FROM, AUDIT_NOW, pushEvent, seedRealisticEvents } from './__fixtures__/realistic-events';
import type { AnalyticsFilters } from '../filters';

const NOW = AUDIT_NOW;
const CUSTOM_FILTERS: AnalyticsFilters = {
  period: 'custom',
  device: 'all',
  traffic: 'all',
  from: AUDIT_FROM.toISOString(),
  to: NOW.toISOString(),
};

beforeEach(() => {
  resetMemoryStore();
});

function steps(data: Awaited<ReturnType<typeof getFunnelOverview>>) {
  return Object.fromEntries(data.steps.map((s) => [s.stage, s]));
}

describe('Funnel audit — AN-02 (modèle monotonic corrige l’effondrement)', () => {
  it('A03-I001 [AN-02] dataset réaliste → toutes les étapes peuplées (plus de collapse)', async () => {
    seedRealisticEvents();
    const s = steps(await getFunnelOverview(CUSTOM_FILTERS, NOW));
    // 14 sessions : 3 buy(→purchase) + 1 generate_lead(→purchase) + 5 begin_checkout + 1 lead_capture + 4 view.
    expect(s.view!.sessions).toBe(14);
    expect(s.engage!.sessions).toBe(9); // maxRank >= engage : 3 buy + 1 lead_conv + 5 bc
    expect(s.cta!.sessions).toBe(9);
    expect(s.checkout!.sessions).toBe(9);
    expect(s.purchase!.sessions).toBe(4); // 3 purchase + 1 generate_lead
  });

  it('A03-I002 [AN-02] begin_checkout réel est compté en checkout', async () => {
    seedRealisticEvents();
    const s = steps(await getFunnelOverview(CUSTOM_FILTERS, NOW));
    expect(s.checkout!.sessions).toBeGreaterThanOrEqual(9);
  });

  it('A03-I003 [AN-02] purchase réel est compté', async () => {
    seedRealisticEvents();
    const s = steps(await getFunnelOverview(CUSTOM_FILTERS, NOW));
    expect(s.purchase!.sessions).toBeGreaterThanOrEqual(3);
  });

  it('A03-I004 [AN-06] generate_lead compte comme conversion (purchase)', async () => {
    pushEvent({ id: '1', sessionId: 'A', eventName: 'view_item', pageRoute: '/kit' });
    pushEvent({ id: '2', sessionId: 'A', eventName: 'generate_lead' });
    const s = steps(await getFunnelOverview(CUSTOM_FILTERS, NOW));
    expect(s.purchase!.sessions).toBe(1);
  });

  it('A03-I005 [AN-02] add_to_cart fait passer l’étape cta (sans engage explicite)', async () => {
    pushEvent({ id: '1', sessionId: 'A', eventName: 'view_item', pageRoute: '/kit' });
    pushEvent({ id: '2', sessionId: 'A', eventName: 'add_to_cart' });
    const s = steps(await getFunnelOverview(CUSTOM_FILTERS, NOW));
    expect(s.cta!.sessions).toBe(1);
    expect(s.engage!.sessions).toBe(1); // impliqué par cta (monotonic)
  });

  it('A03-I006 [AN-02] monotonie view>=engage>=cta>=checkout>=purchase', async () => {
    pushEvent({ id: '1', sessionId: 'A', eventName: 'view_item', pageRoute: '/kit' });
    pushEvent({ id: '2', sessionId: 'A', eventName: 'begin_checkout' });
    pushEvent({ id: '3', sessionId: 'A', eventName: 'purchase', payload: { value: 320 } });
    pushEvent({ id: '4', sessionId: 'B', eventName: 'view_item', pageRoute: '/kit' });
    pushEvent({ id: '5', sessionId: 'B', eventName: 'add_to_cart' });
    pushEvent({ id: '6', sessionId: 'C', eventName: 'view_item', pageRoute: '/kit' });
    const data = await getFunnelOverview(CUSTOM_FILTERS, NOW);
    const n = data.steps.map((s) => s.sessions);
    for (let i = 1; i < n.length; i += 1) expect(n[i]!).toBeLessThanOrEqual(n[i - 1]!);
    const s = steps(data);
    expect([s.view!.sessions, s.cta!.sessions, s.checkout!.sessions, s.purchase!.sessions]).toEqual([3, 2, 1, 1]);
  });

  it('A03-I007 [AN-02] totalSessions = sessions distinctes', async () => {
    seedRealisticEvents();
    const data = await getFunnelOverview(CUSTOM_FILTERS, NOW);
    expect(data.totalSessions).toBe(14);
  });
});

describe('Funnel audit — AN-02 (drop-off cohérent, plus d’artefact 100 %)', () => {
  it('A04-I001 [AN-02] drop-off view→engage borné (pas 100 % artificiel)', async () => {
    seedRealisticEvents();
    const s = steps(await getFunnelOverview(CUSTOM_FILTERS, NOW));
    expect(s.view!.dropoffToNext).toBeGreaterThan(0);
    expect(s.view!.dropoffToNext).toBeLessThan(1);
  });

  it('A04-I002 [AN-02] étapes intermédiaires sans perte → drop-off 0', async () => {
    seedRealisticEvents();
    const s = steps(await getFunnelOverview(CUSTOM_FILTERS, NOW));
    expect(s.engage!.dropoffToNext).toBeCloseTo(0, 5);
    expect(s.cta!.dropoffToNext).toBeCloseTo(0, 5);
  });

  it('A04-I006 [AN-02] checkout→purchase = vraie chute mesurée', async () => {
    seedRealisticEvents();
    const s = steps(await getFunnelOverview(CUSTOM_FILTERS, NOW));
    expect(s.checkout!.dropoffToNext).toBeCloseTo(1 - 4 / 9, 5);
  });

  it('A04-I007 [AN-02] tout drop-off non-null reste borné [0;1]', async () => {
    seedRealisticEvents();
    const data = await getFunnelOverview(CUSTOM_FILTERS, NOW);
    expect(
      data.steps.every((s) => s.dropoffToNext === null || (s.dropoffToNext >= 0 && s.dropoffToNext <= 1)),
    ).toBe(true);
  });

  it('A04-I010 [AN-02] dernière étape (purchase) drop-off = null', async () => {
    seedRealisticEvents();
    const s = steps(await getFunnelOverview(CUSTOM_FILTERS, NOW));
    expect(s.purchase!.dropoffToNext).toBeNull();
  });
});
