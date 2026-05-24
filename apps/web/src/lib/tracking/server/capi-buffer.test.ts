import { beforeEach, describe, expect, it } from 'vitest';

import {
  BATCH_SIZE,
  clearBuffer,
  getBufferSize,
  popBatch,
  pushBack,
  pushToBatch,
  type CapiBufferedEvent,
} from './capi-buffer';
import { redis } from '@/lib/redis/client';

beforeEach(() => {
  redis.__resetMemoryStore();
});

describe('pushToBatch', () => {
  it('push 1 event → return true + buffer size = 1', async () => {
    const ok = await pushToBatch('meta', { event_name: 'ViewContent' });
    expect(ok).toBe(true);
    expect(await getBufferSize('meta')).toBe(1);
  });

  it('push 5 events → buffer size = 5', async () => {
    for (let i = 0; i < 5; i++) {
      await pushToBatch('meta', { event_name: 'ViewContent', i });
    }
    expect(await getBufferSize('meta')).toBe(5);
  });

  it('providers isolés (meta vs tiktok)', async () => {
    await pushToBatch('meta', { e: 1 });
    await pushToBatch('tiktok', { e: 2 });
    expect(await getBufferSize('meta')).toBe(1);
    expect(await getBufferSize('tiktok')).toBe(1);
  });
});

describe('popBatch', () => {
  it('pop 0 events sur buffer vide → []', async () => {
    expect(await popBatch('meta')).toEqual([]);
  });

  it('push 3 + pop 50 → retourne 3 (limite atteinte)', async () => {
    for (let i = 0; i < 3; i++) {
      await pushToBatch('meta', { i });
    }
    const batch = await popBatch('meta', 50);
    expect(batch).toHaveLength(3);
    expect(await getBufferSize('meta')).toBe(0);
  });

  it('push 100 + pop 50 → retourne 50 (cap batch)', async () => {
    for (let i = 0; i < 100; i++) {
      await pushToBatch('meta', { i });
    }
    const batch = await popBatch('meta');
    expect(batch).toHaveLength(50);
    expect(await getBufferSize('meta')).toBe(50);
  });

  it('events poppés conservent payload + _bufferedAt', async () => {
    await pushToBatch('meta', { event_name: 'Purchase', value: 199 });
    const batch = await popBatch('meta', 1);
    expect(batch).toHaveLength(1);
    expect(batch[0].payload).toEqual({ event_name: 'Purchase', value: 199 });
    expect(batch[0]._bufferedAt).toBeTypeOf('number');
    expect(batch[0]._retry).toBe(0);
  });

  it('FIFO ordering (premier poussé = premier popé)', async () => {
    await pushToBatch('meta', { order: 1 });
    await pushToBatch('meta', { order: 2 });
    await pushToBatch('meta', { order: 3 });
    const batch = await popBatch('meta', 10);
    expect(batch.map((e) => e.payload.order)).toEqual([1, 2, 3]);
  });
});

describe('pushBack — retry', () => {
  it('1 event _retry=0 → re-pushé avec _retry=1', async () => {
    const events: CapiBufferedEvent[] = [{ payload: { a: 1 } }];
    const result = await pushBack('meta', events);
    expect(result.requeued).toBe(1);
    expect(result.dropped).toBe(0);
    const popped = await popBatch('meta');
    expect(popped[0]._retry).toBe(1);
  });

  it('event _retry=5 (au cap) → dropped (pas re-pushé)', async () => {
    const events: CapiBufferedEvent[] = [{ payload: { a: 1 }, _retry: 5 }];
    const result = await pushBack('meta', events);
    expect(result.requeued).toBe(0);
    expect(result.dropped).toBe(1);
    expect(await getBufferSize('meta')).toBe(0);
  });

  it('mix : 2 events ok + 1 au cap → 2 requeued, 1 dropped', async () => {
    const events: CapiBufferedEvent[] = [
      { payload: { a: 1 }, _retry: 0 },
      { payload: { a: 2 }, _retry: 5 }, // dropped
      { payload: { a: 3 }, _retry: 1 },
    ];
    const result = await pushBack('meta', events);
    expect(result.requeued).toBe(2);
    expect(result.dropped).toBe(1);
    expect(await getBufferSize('meta')).toBe(2);
  });
});

describe('clearBuffer', () => {
  it('clear → size = 0', async () => {
    await pushToBatch('meta', { a: 1 });
    await pushToBatch('meta', { a: 2 });
    await clearBuffer('meta');
    expect(await getBufferSize('meta')).toBe(0);
  });
});

describe('BATCH_SIZE constante', () => {
  it('= 50 (Meta CAPI limit)', () => {
    expect(BATCH_SIZE).toBe(50);
  });
});
