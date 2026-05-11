import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore, memoryStore } from '@/lib/db/client';
import { insertRitual } from '@/lib/db/queries/rituals';
import { dispatchRitualEvent } from './webhook-dispatcher';
import { createId } from '@/lib/ids';

beforeEach(() => {
  delete process.env.DATABASE_URL;
  resetMemoryStore();
});
afterEach(() => resetMemoryStore());

const baseRitual = {
  productKey: 'pack-femiglow',
  body: 'Trois mois et l’ongle a retrouvé sa nervure tranquillement.',
  wouldRecommend: 'oui' as const,
  source: 'web' as const,
};

function seedEndpoint(events: string[], active = true) {
  const id = createId('we');
  memoryStore().webhookEndpoints.set(id, {
    id,
    url: 'https://example.test/hook',
    events: events as never[],
    encryptedSecret: 'fixture',
    active,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });
  return id;
}

describe('dispatchRitualEvent', () => {
  it('compte 0 dispatché si aucun endpoint', async () => {
    const r = await insertRitual({ ...baseRitual, status: 'APPROVED', publishedAt: new Date() });
    const result = await dispatchRitualEvent('ritual.approved', r);
    expect(result.dispatched).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('dispatche vers endpoints abonnés à l\'événement', async () => {
    seedEndpoint(['ritual.approved']);
    seedEndpoint(['ritual.approved', 'ritual.rejected']);
    const r = await insertRitual({ ...baseRitual, status: 'APPROVED', publishedAt: new Date() });
    const result = await dispatchRitualEvent('ritual.approved', r);
    expect(result.dispatched).toBe(2);
  });

  it('saute les endpoints non abonnés à l\'event', async () => {
    seedEndpoint(['lead.created']);
    const r = await insertRitual({ ...baseRitual, status: 'APPROVED', publishedAt: new Date() });
    const result = await dispatchRitualEvent('ritual.approved', r);
    expect(result.dispatched).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('saute les endpoints inactifs', async () => {
    seedEndpoint(['ritual.approved'], false);
    const r = await insertRitual({ ...baseRitual, status: 'APPROVED', publishedAt: new Date() });
    const result = await dispatchRitualEvent('ritual.approved', r);
    expect(result.dispatched).toBe(0);
    expect(result.skipped).toBe(1);
  });
});
