/**
 * CHA-232 — Tests du hook `useShippingConfig` et du cache module.
 *
 * Couvre :
 *  - Fetch /api/checkout/shipping-config au premier mount.
 *  - Cache mémoire partagé : un seul fetch même avec plusieurs hooks.
 *  - Fallback `freeShipping: true` en cas d'erreur réseau.
 *  - Respect du payload serveur (true/false).
 */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetShippingConfigCache,
  useShippingConfig,
} from './use-shipping-config';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  __resetShippingConfigCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useShippingConfig', () => {
  it('fetch la config au premier mount et expose freeShipping', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ freeShipping: true }));

    const { result } = renderHook(() => useShippingConfig());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.freeShipping).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      '/api/checkout/shipping-config',
    );
  });

  it('respecte freeShipping=false renvoyé par l\'API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ freeShipping: false }),
    );

    const { result } = renderHook(() => useShippingConfig());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.freeShipping).toBe(false);
  });

  it('partage le cache entre plusieurs hooks (1 seul fetch)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ freeShipping: true }));

    const { result: r1 } = renderHook(() => useShippingConfig());
    const { result: r2 } = renderHook(() => useShippingConfig());

    await waitFor(() => {
      expect(r1.current.loading).toBe(false);
      expect(r2.current.loading).toBe(false);
    });
    expect(r1.current.freeShipping).toBe(true);
    expect(r2.current.freeShipping).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('fallback freeShipping=true en cas d\'erreur réseau', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useShippingConfig());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.freeShipping).toBe(true);
  });

  it('fallback freeShipping=true en cas de payload invalide', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ unrelated: 1 }),
    );

    const { result } = renderHook(() => useShippingConfig());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.freeShipping).toBe(true);
  });
});
