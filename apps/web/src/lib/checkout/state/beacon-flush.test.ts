// @vitest-environment jsdom
/**
 * OWBS — TST-U-17 : beacon-flush envoie les envelopes en attente vers /sync
 * sur pagehide / visibilitychange:hidden ; no-op si la file est vide.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installBeaconFlush, SYNC_ENDPOINT } from './beacon-flush';
import type { Envelope, LeadSyncQueue } from './lead-sync-queue';

const ENV: Envelope = {
  mutationId: 'mut_1',
  leadId: 'cl_aaaaaaaaaaaaaaaaaaaa',
  scope: 'lead_create',
  endpoint: '/api/checkout/lead',
  method: 'POST',
  idempotencyKey: 'idem_lead',
  payload: { firstName: 'Salma' },
  enqueuedAt: '2026-06-02T00:00:00.000Z',
  attempt: 0,
};

function fakeQueue(pending: Envelope[]): LeadSyncQueue {
  return {
    enqueue: vi.fn(),
    flush: vi.fn(),
    pending: () => pending,
    hydrateFromMirror: vi.fn(),
    clear: vi.fn(),
  } as unknown as LeadSyncQueue;
}

let teardown: (() => void) | undefined;
afterEach(() => {
  teardown?.();
  teardown = undefined;
  vi.restoreAllMocks();
});

function stubBeacon(): ReturnType<typeof vi.fn> {
  const beacon = vi.fn(() => true);
  Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
  return beacon;
}

describe('installBeaconFlush', () => {
  it('pagehide → sendBeacon vers /sync avec les envelopes', async () => {
    const beacon = stubBeacon();
    teardown = installBeaconFlush(fakeQueue([ENV]));
    window.dispatchEvent(new Event('pagehide'));
    expect(beacon).toHaveBeenCalledOnce();
    expect(beacon.mock.calls[0]![0]).toBe(SYNC_ENDPOINT);
    const blob = beacon.mock.calls[0]![1] as Blob;
    const text = await blob.text();
    expect(text).toContain('cl_aaaaaaaaaaaaaaaaaaaa');
    expect(text).toContain('lead_create');
    expect(text).toContain('"sentVia":"beacon"');
  });

  it('file vide → aucun envoi', () => {
    const beacon = stubBeacon();
    teardown = installBeaconFlush(fakeQueue([]));
    window.dispatchEvent(new Event('pagehide'));
    expect(beacon).not.toHaveBeenCalled();
  });

  it('visibilitychange: flush si hidden, pas si visible', () => {
    const beacon = stubBeacon();
    teardown = installBeaconFlush(fakeQueue([ENV]));

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(beacon).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(beacon).toHaveBeenCalledOnce();
  });

  it('teardown retire les listeners', () => {
    const beacon = stubBeacon();
    const stop = installBeaconFlush(fakeQueue([ENV]));
    stop();
    window.dispatchEvent(new Event('pagehide'));
    expect(beacon).not.toHaveBeenCalled();
  });
});
