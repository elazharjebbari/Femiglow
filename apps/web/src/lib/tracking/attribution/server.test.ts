/**
 * Tests d'intégration pour get/setAttributionStrategy.
 *
 * Utilise `memoryStore` (mode sans DB) en isolant via `resetMemoryStore`
 * avant chaque test. Couvre :
 *  - Défaut quand absent
 *  - Round-trip set→get
 *  - Rejet d'une valeur invalide
 *  - Tolérance d'une valeur corrompue en DB
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore, memoryStore } from '@/lib/db/client';
import {
  setTrackingSetting,
  TRACKING_SETTING_KEYS,
} from '@/lib/db/queries/tracking/settings';
import {
  getAttributionStrategy,
  setAttributionStrategy,
} from './server';
import { DEFAULT_ATTRIBUTION_STRATEGY } from './types';

beforeEach(() => {
  resetMemoryStore();
});

describe('getAttributionStrategy — défaut', () => {
  it('renvoie last_paid_touch quand la setting est absente', async () => {
    const s = await getAttributionStrategy();
    expect(s).toBe(DEFAULT_ATTRIBUTION_STRATEGY);
    expect(s).toBe('last_paid_touch');
  });

  it('renvoie last_paid_touch quand la setting a une valeur corrompue', async () => {
    await setTrackingSetting(
      TRACKING_SETTING_KEYS.ATTRIBUTION_STRATEGY,
      'not_a_valid_strategy',
    );
    expect(await getAttributionStrategy()).toBe('last_paid_touch');
  });
});

describe('setAttributionStrategy', () => {
  it('round-trip set/get', async () => {
    await setAttributionStrategy('first_paid_touch');
    expect(await getAttributionStrategy()).toBe('first_paid_touch');
  });

  it('accepte toutes les stratégies valides', async () => {
    for (const s of ['last_paid_touch', 'first_paid_touch', 'last_touch', 'first_touch', 'broadcast'] as const) {
      await setAttributionStrategy(s);
      expect(await getAttributionStrategy()).toBe(s);
    }
  });

  it('rejette une valeur invalide', async () => {
    await expect(
      setAttributionStrategy('foobar' as never),
    ).rejects.toThrow(/invalid_attribution_strategy/);
  });

  it('persiste avec actorId pour l\'audit', async () => {
    await setAttributionStrategy('broadcast', { actorId: 'adm_test_123' });
    // Vérifie côté memory store que updatedBy est bien renseigné
    const settings = Array.from(memoryStore().trackingSettings.values());
    const row = settings.find((s) => s.key === TRACKING_SETTING_KEYS.ATTRIBUTION_STRATEGY);
    expect(row?.updatedBy).toBe('adm_test_123');
  });
});
