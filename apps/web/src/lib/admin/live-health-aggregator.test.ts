import { beforeEach, describe, expect, it } from 'vitest';

import { getLiveHealthSnapshot } from './live-health-aggregator';
import { redis } from '@/lib/redis/client';
import { recordStreamingMetrics } from '@/lib/chat/services/streaming-health';
import { pushToBatch } from '@/lib/tracking/server/capi-buffer';

beforeEach(() => {
  redis.__resetMemoryStore();
});

describe('getLiveHealthSnapshot — structure', () => {
  it('retourne 3 sections (chat, publishing, tracking)', async () => {
    const snap = await getLiveHealthSnapshot();
    expect(snap.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(snap.chat).toBeDefined();
    expect(snap.publishing).toBeDefined();
    expect(snap.tracking).toBeDefined();
    expect(snap.alerts).toBeInstanceOf(Array);
  });

  it('chat.breakers liste les providers connus', async () => {
    const snap = await getLiveHealthSnapshot();
    expect(snap.chat.breakers.length).toBeGreaterThanOrEqual(2);
    expect(snap.chat.breakers.every((b) => b.state === 'CLOSED')).toBe(true);
  });

  it('tracking.bufferSizesByProvider liste les 4 providers CAPI', async () => {
    const snap = await getLiveHealthSnapshot();
    expect(snap.tracking.bufferSizesByProvider).toHaveLength(4);
    expect(snap.tracking.bufferSizesByProvider.map((s) => s.provider).sort()).toEqual(
      ['meta', 'pinterest', 'snap', 'tiktok'],
    );
  });
});

describe('getLiveHealthSnapshot — alerts', () => {
  it('aucune alert quand rien dégradé', async () => {
    const snap = await getLiveHealthSnapshot();
    expect(snap.alerts).toEqual([]);
  });

  it('tracking buffer > 1000 → alert critical', async () => {
    // Push 1100 events dans le buffer Meta
    for (let i = 0; i < 1100; i++) {
      await pushToBatch('meta', { i });
    }
    const snap = await getLiveHealthSnapshot();
    const trackingAlerts = snap.alerts.filter((a) => a.system === 'tracking');
    expect(trackingAlerts.length).toBeGreaterThan(0);
    expect(trackingAlerts[0]!.level).toBe('critical');
  });

  it('tracking buffer 600 → alert warning (pas critical)', async () => {
    for (let i = 0; i < 600; i++) {
      await pushToBatch('meta', { i });
    }
    const snap = await getLiveHealthSnapshot();
    const trackingAlerts = snap.alerts.filter((a) => a.system === 'tracking');
    expect(trackingAlerts.length).toBeGreaterThan(0);
    expect(trackingAlerts[0]!.level).toBe('warning');
  });

  it('chat drop rate > 10% → alert critical', async () => {
    // 1 stream OK, 2 drops → drop rate 67%
    await recordStreamingMetrics({
      sessionId: 's1',
      provider: 'openai',
      chunkCount: 5,
      firstChunkLatencyMs: 100,
      totalLatencyMs: 1000,
      avgInterChunkMs: 50,
      p95InterChunkMs: 100,
      dropped: false,
    });
    await recordStreamingMetrics({
      sessionId: 's2',
      provider: 'openai',
      chunkCount: 2,
      firstChunkLatencyMs: 100,
      totalLatencyMs: 500,
      avgInterChunkMs: 50,
      p95InterChunkMs: 100,
      dropped: true,
    });
    await recordStreamingMetrics({
      sessionId: 's3',
      provider: 'openai',
      chunkCount: 3,
      firstChunkLatencyMs: 100,
      totalLatencyMs: 500,
      avgInterChunkMs: 50,
      p95InterChunkMs: 100,
      dropped: true,
    });
    const snap = await getLiveHealthSnapshot();
    const chatAlerts = snap.alerts.filter((a) => a.system === 'chat');
    expect(chatAlerts.length).toBeGreaterThan(0);
    expect(chatAlerts[0]!.level).toBe('critical');
  });
});
