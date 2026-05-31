/**
 * Tests du repository attribution. Mode in-memory (memoryStore).
 *
 * Couvre :
 *   - findAttributionByVisitor : null si inconnu, snapshot sinon
 *   - upsertAttribution : insert premier touch, update préserve
 *     first_touch + refresh last_touch + LRU paid_history
 *   - purgeOldAttributions : supprime ce qui est > N jours
 *   - Rejet des touches malformées (validation Zod)
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryStore, resetMemoryStore } from '@/lib/db/client';
import {
  findAttributionByVisitor,
  purgeOldAttributions,
  upsertAttribution,
} from './repository';
import type { ChannelTouch } from './types';

function touch(overrides: Partial<ChannelTouch> = {}): ChannelTouch {
  return {
    channel: 'direct',
    is_paid: false,
    detected_at: '2026-05-15T12:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  resetMemoryStore();
});

describe('findAttributionByVisitor', () => {
  it('renvoie null pour un visitor inconnu', async () => {
    expect(await findAttributionByVisitor('v_unknown')).toBeNull();
  });
});

describe('upsertAttribution — insert', () => {
  it('crée la ligne au 1er touch', async () => {
    const snap = await upsertAttribution({
      visitorId: 'v_new',
      touch: touch({ channel: 'meta', is_paid: true, click_id: 'fb1', click_id_field: 'fbclid' }),
    });
    expect(snap.first_touch?.channel).toBe('meta');
    expect(snap.last_touch?.channel).toBe('meta');
    expect(snap.paid_history).toHaveLength(1);

    // Vérifie en DB (memoryStore)
    const row = memoryStore().visitorAttribution.get('v_new');
    expect(row).toBeDefined();
    expect(row?.createdAt).toBeInstanceOf(Date);
  });
});

describe('upsertAttribution — update', () => {
  it('préserve first_touch + refresh last_touch + prepend paid_history', async () => {
    await upsertAttribution({
      visitorId: 'v_x',
      touch: touch({ channel: 'meta', is_paid: true, click_id: 'fb1', click_id_field: 'fbclid' }),
    });
    const snap = await upsertAttribution({
      visitorId: 'v_x',
      touch: touch({ channel: 'google_ads', is_paid: true, click_id: 'g1', click_id_field: 'gclid' }),
    });
    expect(snap.first_touch?.channel).toBe('meta');     // immuable
    expect(snap.last_touch?.channel).toBe('google_ads'); // refresh
    expect(snap.paid_history[0]?.channel).toBe('google_ads');
    expect(snap.paid_history[1]?.channel).toBe('meta');
  });

  it('dédup par click_id', async () => {
    const t = touch({ channel: 'meta', is_paid: true, click_id: 'fb_same' });
    await upsertAttribution({ visitorId: 'v_dup', touch: t });
    const snap = await upsertAttribution({ visitorId: 'v_dup', touch: t });
    expect(snap.paid_history).toHaveLength(1);
  });

  it('LRU 20 sur paid_history', async () => {
    for (let i = 0; i < 25; i += 1) {
      await upsertAttribution({
        visitorId: 'v_lru',
        touch: touch({ channel: 'meta', is_paid: true, click_id: `fb${i}` }),
      });
    }
    const snap = await findAttributionByVisitor('v_lru');
    expect(snap?.paid_history).toHaveLength(20);
    expect(snap?.paid_history[0]?.click_id).toBe('fb24'); // le plus récent
  });

  it('rejette un touch malformé', async () => {
    await expect(
      upsertAttribution({
        visitorId: 'v_bad',
        touch: { channel: 'not_a_real_channel' } as never,
      }),
    ).rejects.toThrow();
  });
});

describe('purgeOldAttributions', () => {
  it('supprime les snapshots > N jours', async () => {
    await upsertAttribution({ visitorId: 'v_old', touch: touch({ channel: 'meta', is_paid: true }) });
    // Backdater
    const row = memoryStore().visitorAttribution.get('v_old');
    if (row) row.updatedAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    await upsertAttribution({ visitorId: 'v_recent', touch: touch({ channel: 'meta', is_paid: true }) });
    const removed = await purgeOldAttributions(90);
    expect(removed).toBe(1);
    expect(await findAttributionByVisitor('v_old')).toBeNull();
    expect(await findAttributionByVisitor('v_recent')).not.toBeNull();
  });
});
