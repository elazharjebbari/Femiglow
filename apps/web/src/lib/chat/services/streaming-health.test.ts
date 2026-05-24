import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  recordStreamingMetrics,
  StreamingMeter,
  getRecentStreamingHealth,
  type StreamingMetrics,
} from './streaming-health';
import { redis } from '@/lib/redis/client';

beforeEach(() => {
  redis.__resetMemoryStore();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-24T22:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

function baseMetrics(overrides: Partial<StreamingMetrics> = {}): StreamingMetrics {
  return {
    sessionId: 'sess_1',
    provider: 'openai',
    chunkCount: 20,
    firstChunkLatencyMs: 800,
    totalLatencyMs: 3500,
    avgInterChunkMs: 100,
    p95InterChunkMs: 250,
    dropped: false,
    ...overrides,
  };
}

describe('recordStreamingMetrics', () => {
  it('record success → total counter incrémenté', async () => {
    await recordStreamingMetrics(baseMetrics());
    const summaries = await getRecentStreamingHealth(5);
    expect(summaries.length).toBeGreaterThan(0);
    expect(summaries[0]!.totalStreams).toBe(1);
  });

  it('record dropped → drops counter incrémenté', async () => {
    await recordStreamingMetrics(
      baseMetrics({ dropped: true, dropReason: 'Connection closed' }),
    );
    const summaries = await getRecentStreamingHealth(5);
    expect(summaries[0]!.drops).toBe(1);
    expect(summaries[0]!.dropRatePct).toBe(100);
  });

  it('5 streams dont 1 drop → dropRatePct 20%', async () => {
    for (let i = 0; i < 4; i++) {
      await recordStreamingMetrics(baseMetrics({ sessionId: `s${i}` }));
    }
    await recordStreamingMetrics(
      baseMetrics({ sessionId: 's_drop', dropped: true }),
    );
    const summaries = await getRecentStreamingHealth(5);
    expect(summaries[0]!.totalStreams).toBe(5);
    expect(summaries[0]!.drops).toBe(1);
    expect(summaries[0]!.dropRatePct).toBe(20);
  });
});

describe('StreamingMeter', () => {
  it('snapshot vierge → 0 chunks, latences 0', () => {
    const m = new StreamingMeter('s1', 'openai');
    const snap = m.snapshot();
    expect(snap.chunkCount).toBe(0);
    expect(snap.firstChunkLatencyMs).toBe(0);
    expect(snap.totalLatencyMs).toBe(0);
  });

  it('chunks séquentiels → latence first + inter calculées', () => {
    const m = new StreamingMeter('s1', 'openai');

    vi.advanceTimersByTime(500); // 500ms avant 1er chunk
    m.onChunk();

    vi.advanceTimersByTime(100);
    m.onChunk();

    vi.advanceTimersByTime(150);
    m.onChunk();

    vi.advanceTimersByTime(200);
    m.onChunk();

    const snap = m.snapshot();
    expect(snap.chunkCount).toBe(4);
    expect(snap.firstChunkLatencyMs).toBe(500);
    expect(snap.totalLatencyMs).toBe(950); // 500+100+150+200
    // Inter-chunks : [100, 150, 200] → avg=150
    expect(snap.avgInterChunkMs).toBe(150);
    expect(snap.p95InterChunkMs).toBeGreaterThanOrEqual(150);
  });

  it('onDrop marque le stream + reason', () => {
    const m = new StreamingMeter('s1', 'openai');
    m.onChunk();
    m.onDrop('Network timeout');
    const snap = m.snapshot();
    expect(snap.dropped).toBe(true);
    expect(snap.dropReason).toBe('Network timeout');
  });

  it('snapshot ne mute pas l\'état', () => {
    const m = new StreamingMeter('s1', 'openai');
    m.onChunk();
    const s1 = m.snapshot();
    const s2 = m.snapshot();
    expect(s1).toEqual(s2);
  });

  it('provider passé à la création est exposé dans snapshot', () => {
    const m = new StreamingMeter('s1', 'anthropic');
    const snap = m.snapshot();
    expect(snap.provider).toBe('anthropic');
  });
});

describe('getRecentStreamingHealth', () => {
  it('aucun stream → empty array', async () => {
    const summaries = await getRecentStreamingHealth(10);
    expect(summaries).toEqual([]);
  });

  it('lookback=1 limite à 1 minute', async () => {
    await recordStreamingMetrics(baseMetrics());
    const summaries = await getRecentStreamingHealth(1);
    expect(summaries.length).toBeLessThanOrEqual(1);
  });
});
