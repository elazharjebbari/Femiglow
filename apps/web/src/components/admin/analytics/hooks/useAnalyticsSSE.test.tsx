/**
 * Tests useAnalyticsSSE — SSE primary, polling fallback, pause/resume.
 * cf. docs/analytics/06-tests-strategy.md §3.5
 *
 * On simule EventSource via une classe maison qu'on injecte dans
 * `globalThis.EventSource`, plutôt qu'une vraie connexion réseau.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LiveSnapshot } from '@/lib/analytics/queries/live';
import { useAnalyticsSSE } from './useAnalyticsSSE';

// ─── Fake EventSource ─────────────────────────────────────────────────

type EvtListener = (evt: Event) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  readyState = 0;
  listeners = new Map<string, EvtListener[]>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
    // open est asynchrone dans les vrais EventSources
    queueMicrotask(() => this.dispatch('open', new Event('open')));
  }

  addEventListener(type: string, fn: EvtListener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, fn: EvtListener): void {
    const list = (this.listeners.get(type) ?? []).filter((f) => f !== fn);
    this.listeners.set(type, list);
  }

  dispatch(type: string, evt: Event): void {
    for (const fn of this.listeners.get(type) ?? []) fn(evt);
  }

  pushSnapshot(snap: Partial<LiveSnapshot>): void {
    const evt = new MessageEvent('snapshot', {
      data: JSON.stringify(snap),
    });
    this.dispatch('snapshot', evt);
  }

  failConnection(): void {
    this.dispatch('error', new Event('error'));
  }

  close(): void {
    this.readyState = 2;
  }
}

const FETCH_OK = (snap: Partial<LiveSnapshot>): typeof fetch =>
  vi.fn(async () =>
    new Response(JSON.stringify(snap), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch;

beforeEach(() => {
  FakeEventSource.instances.length = 0;
  // @ts-expect-error -- override global pour tests
  globalThis.EventSource = FakeEventSource;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useAnalyticsSSE', () => {
  it('opens an SSE connection and surfaces snapshots', async () => {
    const { result } = renderHook(() => useAnalyticsSSE({ window: '1h' }));

    await waitFor(() => {
      expect(FakeEventSource.instances).toHaveLength(1);
    });
    const es = FakeEventSource.instances[0]!;
    expect(es.url).toContain('/api/admin/analytics/live/stream?window=1h');

    await waitFor(() => {
      expect(result.current.status).toBe('open');
    });

    act(() => {
      es.pushSnapshot({
        generatedAt: '2026-05-06T12:00:00Z',
        window: '1h',
        kpiBig: { online: 5, conversions: 1, ctaPurchase: 0, windowMinutes: 60 },
      });
    });

    await waitFor(() => {
      expect(result.current.data?.kpiBig.online).toBe(5);
    });
  });

  it('falls back to polling after 3 disconnects in 30s', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      FETCH_OK({
        generatedAt: '2026-05-06T12:00:00Z',
        window: '1h',
        kpiBig: { online: 9, conversions: 0, ctaPurchase: 0, windowMinutes: 60 },
      }),
    );

    const { result } = renderHook(() => useAnalyticsSSE({ window: '1h' }));

    await waitFor(() => {
      expect(FakeEventSource.instances).toHaveLength(1);
    });
    const es = FakeEventSource.instances[0]!;

    // Notre FakeEventSource conserve ses listeners même après `close()`, donc
    // 3 dispatches d'`error` sur la même instance déclenchent 3 fois le
    // handler du hook → recordDisconnect() atteint le seuil. Pas besoin
    // d'attendre les reconnect timeouts (1s, 2s, 4s) — qui rendraient le
    // test instable contre le default waitFor (1s).
    act(() => {
      es.failConnection();
      es.failConnection();
      es.failConnection();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('polling');
    });
    await waitFor(() => {
      expect(result.current.data?.kpiBig.online).toBe(9);
    });
  });

  it('uses polling immediately when forcePolling=true (no SSE attempt)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      FETCH_OK({
        generatedAt: '2026-05-06T12:00:00Z',
        window: '1h',
        kpiBig: { online: 3, conversions: 0, ctaPurchase: 0, windowMinutes: 60 },
      }),
    );

    const { result } = renderHook(() =>
      useAnalyticsSSE({ window: '1h', forcePolling: true }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('polling');
    });
    expect(FakeEventSource.instances).toHaveLength(0); // jamais ouvert
    await waitFor(() => {
      expect(result.current.data?.kpiBig.online).toBe(3);
    });
  });

  it('stops streaming on pause and resumes on resume', async () => {
    const { result } = renderHook(() => useAnalyticsSSE({ window: '1h' }));

    await waitFor(() => {
      expect(FakeEventSource.instances).toHaveLength(1);
      expect(result.current.status).toBe('open');
    });

    act(() => {
      result.current.pause();
    });
    await waitFor(() => {
      expect(result.current.status).toBe('paused');
      expect(result.current.paused).toBe(true);
    });

    act(() => {
      result.current.resume();
    });
    await waitFor(() => {
      expect(result.current.paused).toBe(false);
    });
    // Une nouvelle instance EventSource a été créée
    expect(FakeEventSource.instances.length).toBeGreaterThanOrEqual(2);
  });

  it('does nothing when enabled=false', async () => {
    const { result } = renderHook(() =>
      useAnalyticsSSE({ window: '1h', enabled: false }),
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(FakeEventSource.instances).toHaveLength(0);
    expect(result.current.status).toBe('idle');
  });
});
