/**
 * Test contractuel — les chemins `DATALAYER_PATHS` (utilisés comme `name` des
 * DLV GTM) doivent résoudre sur une `DataLayerEntry` RÉELLEMENT produite par
 * `TrackingClient.emit`. Empêche la réapparition du bug T-01 (un chemin DLV
 * divergent de la structure de l'entry → variable `undefined` → ROAS faux).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { TrackingClient } from './client';
import { getDataLayer } from './datalayer';
import { DATALAYER_PATHS } from './datalayer-paths';

function resolvePath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === 'object'
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    );
}

// Consentement refusé : l'entry est poussée au dataLayer AVANT le gate consent
// (cf. client.ts), donc on capture l'entry sans déclencher de flush réseau.
function makeClient() {
  return new TrackingClient({
    consent: () => ({
      ad_storage: 'denied',
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functional_storage: 'denied',
    }),
    user: () => ({ anonymous_id: 'anon_1', session_id: 'sess_1' }),
    page: () => ({
      url: 'https://femiglow.ma/kit',
      path: '/kit',
      title: '',
      referrer: '',
      locale: 'fr-MA',
    }),
  });
}

describe('DATALAYER_PATHS — contrat avec DataLayerEntry réelle', () => {
  beforeEach(() => {
    getDataLayer().flush();
  });

  it('chaque chemin de conversion résout sur une entry émise', () => {
    makeClient().emit('purchase', {
      value: 199,
      currency: 'MAD',
      transaction_id: 'tx_1',
      items: [{ item_id: 'kit' }],
    });
    const entry = getDataLayer().recent(1)[0];
    expect(entry).toBeDefined();
    expect(resolvePath(entry, DATALAYER_PATHS.eventId)).toBe(entry!.event_id);
    expect(resolvePath(entry, DATALAYER_PATHS.value)).toBe(199);
    expect(resolvePath(entry, DATALAYER_PATHS.currency)).toBe('MAD');
    expect(resolvePath(entry, DATALAYER_PATHS.transactionId)).toBe('tx_1');
    expect(resolvePath(entry, DATALAYER_PATHS.items)).toEqual([{ item_id: 'kit' }]);
  });

  it('le chemin legacy `ecommerce.value` ne résout PAS (preuve du bug T-01)', () => {
    makeClient().emit('purchase', { value: 199, currency: 'MAD' });
    const entry = getDataLayer().recent(1)[0];
    expect(resolvePath(entry, 'ecommerce.value')).toBeUndefined();
    // …alors que le bon chemin, lui, résout.
    expect(resolvePath(entry, DATALAYER_PATHS.value)).toBe(199);
  });
});
