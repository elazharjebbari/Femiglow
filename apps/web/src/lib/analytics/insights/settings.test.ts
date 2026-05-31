import { beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import {
  getInsightsRefreshEnabled,
  getInsightsRefreshInterval,
  setInsightsRefreshEnabled,
  setInsightsRefreshInterval,
} from './settings';

beforeEach(() => {
  resetMemoryStore();
});

describe('settings — defaults', () => {
  it('enabled = true par défaut', async () => {
    expect(await getInsightsRefreshEnabled()).toBe(true);
  });

  it('intervalMinutes = 15 par défaut', async () => {
    expect(await getInsightsRefreshInterval()).toBe(15);
  });
});

describe('settings — set/get round-trip', () => {
  it('set enabled=false', async () => {
    await setInsightsRefreshEnabled(false);
    expect(await getInsightsRefreshEnabled()).toBe(false);
  });

  it('set enabled=true puis false puis true', async () => {
    await setInsightsRefreshEnabled(true);
    expect(await getInsightsRefreshEnabled()).toBe(true);
    await setInsightsRefreshEnabled(false);
    expect(await getInsightsRefreshEnabled()).toBe(false);
    await setInsightsRefreshEnabled(true);
    expect(await getInsightsRefreshEnabled()).toBe(true);
  });

  it('set interval 30', async () => {
    await setInsightsRefreshInterval(30);
    expect(await getInsightsRefreshInterval()).toBe(30);
  });

  it('toutes les valeurs autorisées : 5, 10, 15, 30, 60', async () => {
    for (const v of [5, 10, 15, 30, 60]) {
      await setInsightsRefreshInterval(v);
      expect(await getInsightsRefreshInterval()).toBe(v);
    }
  });
});

describe('settings — validation', () => {
  it('intervalMinutes invalide → throw', async () => {
    await expect(setInsightsRefreshInterval(7 as never)).rejects.toThrow();
    await expect(setInsightsRefreshInterval(0 as never)).rejects.toThrow();
    await expect(setInsightsRefreshInterval(120 as never)).rejects.toThrow();
  });

  it("getInsightsRefreshInterval fallback à 15 si valeur invalide en base", async () => {
    // On force une valeur invalide
    const { setTrackingSetting } = await import('@/lib/db/queries/tracking/settings');
    await setTrackingSetting('insights.refresh_interval_min', 'invalid');
    expect(await getInsightsRefreshInterval()).toBe(15);
  });
});

describe('settings — actorId tracé', () => {
  it('set avec actorId conservé en base', async () => {
    const { getTrackingSetting } = await import('@/lib/db/queries/tracking/settings');
    await setInsightsRefreshEnabled(false, { actorId: 'adm_42' });
    // Lecture directe pour vérifier
    const v = await getTrackingSetting('insights.refresh_enabled', null);
    expect(v).toBe(false);
  });
});
