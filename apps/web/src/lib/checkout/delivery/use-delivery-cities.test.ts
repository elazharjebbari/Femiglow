/**
 * CHA-230 — Tests du hook `useDeliveryCities`.
 *
 * Couvre :
 *  - Debounce 200ms par défaut (configurable, 0 désactive).
 *  - Cache mémoire keyé `cc|qLower|limit` — pas de double-fetch sur même clé.
 *  - Tolérance erreur réseau et HTTP non-200 : pas de crash, `error` exposé.
 *  - URL bien construite (countryCode, limit, q).
 *  - AbortError ne pollue pas le state error (annulation contrôlée).
 *
 * Stratégie : on utilise `debounceMs: 0` dans la plupart des tests pour éviter
 * de manipuler `vi.useFakeTimers()` (qui rentre en conflit avec `waitFor`).
 * Le comportement debounce par défaut est testé séparément avec des assertions
 * synchrones.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetDeliveryCitiesCacheForTests,
  isDbCitiesEnabled,
  useDeliveryCities,
  type PublicCity,
} from './use-delivery-cities';

const CASA: PublicCity = {
  slug: 'casablanca',
  nameFr: 'Casablanca',
  nameAr: 'الدار البيضاء',
  deliveryPriceMad: 19,
  deliveryEta: '24h',
  aliases: ['Casa'],
};

const RABAT: PublicCity = {
  slug: 'rabat',
  nameFr: 'Rabat',
  nameAr: 'الرباط',
  deliveryPriceMad: 29,
  deliveryEta: '24h - 48h',
  aliases: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  __resetDeliveryCitiesCacheForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useDeliveryCities — fetch', () => {
  it('fetch les items + construit l\'URL avec q/countryCode/limit', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ items: [CASA] }));

    const { result } = renderHook(() =>
      useDeliveryCities('Casa', { debounceMs: 0 }),
    );

    await waitFor(() => {
      expect(result.current.items).toEqual([CASA]);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toContain('q=Casa');
    expect(url).toContain('countryCode=MA');
    expect(url).toContain('limit=8');
  });

  it('debounce 200ms par défaut — pas de fetch avant 200ms', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ items: [CASA] }));

    renderHook(() => useDeliveryCities('Casa'));

    // Immédiatement après le mount : aucun fetch encore.
    expect(fetchSpy).not.toHaveBeenCalled();

    // Après 250ms le fetch est déclenché.
    await new Promise((r) => setTimeout(r, 250));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('cache hit : pas de re-fetch pour la même clé `cc|qLower|limit`', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ items: [CASA] }));

    const { result: r1, unmount } = renderHook(() =>
      useDeliveryCities('Casa', { debounceMs: 0 }),
    );
    await waitFor(() => expect(r1.current.items).toEqual([CASA]));
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // On re-monte le hook avec la même query : le cache devrait servir.
    unmount();
    fetchSpy.mockClear();

    const { result: r2 } = renderHook(() =>
      useDeliveryCities('Casa', { debounceMs: 0 }),
    );
    await waitFor(() => expect(r2.current.items).toEqual([CASA]));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('cache key inclut countryCode (changement de pays = nouveau fetch)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('countryCode=MA')) return jsonResponse({ items: [CASA] });
      if (u.includes('countryCode=FR')) return jsonResponse({ items: [] });
      return jsonResponse({ items: [] });
    });

    const { result, rerender } = renderHook(
      ({ cc }: { cc: string }) =>
        useDeliveryCities('Casa', { countryCode: cc, debounceMs: 0 }),
      { initialProps: { cc: 'MA' } },
    );

    await waitFor(() => expect(result.current.items).toEqual([CASA]));
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    rerender({ cc: 'FR' });
    await waitFor(() => expect(result.current.items).toEqual([]));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('respecte le limit demandé dans l\'URL', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ items: [CASA, RABAT] }));

    const { result } = renderHook(() =>
      useDeliveryCities('R', { limit: 3, debounceMs: 0 }),
    );
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toContain('limit=3');
  });
});

describe('useDeliveryCities — error handling', () => {
  it('HTTP 500 → state.error renseigné, pas de crash', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, 500));

    const { result } = renderHook(() =>
      useDeliveryCities('Casa', { debounceMs: 0 }),
    );

    await waitFor(() => {
      expect(result.current.error).toMatch(/HTTP\s*500/);
    });
    expect(result.current.loading).toBe(false);
  });

  it('réseau down (rejette) → state.error renseigné', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Failed to fetch'));

    const { result } = renderHook(() =>
      useDeliveryCities('Casa', { debounceMs: 0 }),
    );
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it('AbortError ne pollue PAS le state error (annulation contrôlée)', async () => {
    // Premier appel jamais résolu — on simule une frappe qui doit l'annuler.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err: Error & { name: string } = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );

    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useDeliveryCities(q, { debounceMs: 0 }),
      { initialProps: { q: 'C' } },
    );

    // Laisse le temps au premier fetch de partir.
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.error).toBeNull();

    // Frappe suivante : abort la précédente.
    rerender({ q: 'Ca' });
    await new Promise((r) => setTimeout(r, 30));
    // Pas d'erreur AbortError dans le state.
    expect(result.current.error).toBeNull();
  });
});

describe('useDeliveryCities — items malformés', () => {
  it("retourne [] si body.items n'est pas un array", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ items: 'oops' }),
    );

    const { result } = renderHook(() =>
      useDeliveryCities('Casa', { debounceMs: 0 }),
    );
    await waitFor(() => {
      expect(result.current.items).toEqual([]);
      expect(result.current.loading).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Feature flag NEXT_PUBLIC_USE_DB_CITIES
// ─────────────────────────────────────────────────────────────────────────────

describe('useDeliveryCities — feature flag NEXT_PUBLIC_USE_DB_CITIES', () => {
  const originalEnv = process.env.NEXT_PUBLIC_USE_DB_CITIES;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_USE_DB_CITIES;
    } else {
      process.env.NEXT_PUBLIC_USE_DB_CITIES = originalEnv;
    }
  });

  it('isDbCitiesEnabled() — defaut = true (flag absente)', () => {
    delete process.env.NEXT_PUBLIC_USE_DB_CITIES;
    expect(isDbCitiesEnabled()).toBe(true);
  });

  it('isDbCitiesEnabled() — chaine vide = true', () => {
    process.env.NEXT_PUBLIC_USE_DB_CITIES = '';
    expect(isDbCitiesEnabled()).toBe(true);
  });

  it.each(['false', 'False', '0', 'off', 'no', ' FALSE '])(
    'isDbCitiesEnabled() — %s => false',
    (v) => {
      process.env.NEXT_PUBLIC_USE_DB_CITIES = v;
      expect(isDbCitiesEnabled()).toBe(false);
    },
  );

  it.each(['true', '1', 'on', 'yes', 'TRUE'])(
    'isDbCitiesEnabled() — %s => true (toute autre valeur est truthy)',
    (v) => {
      process.env.NEXT_PUBLIC_USE_DB_CITIES = v;
      expect(isDbCitiesEnabled()).toBe(true);
    },
  );

  it('flag=false : pas de fetch réseau, dataset statique exposé', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ items: [CASA] }));
    process.env.NEXT_PUBLIC_USE_DB_CITIES = 'false';

    const { result } = renderHook(() =>
      useDeliveryCities('Casa', { debounceMs: 0, limit: 5 }),
    );

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });
    // Aucun appel au endpoint API.
    expect(fetchSpy).not.toHaveBeenCalled();
    // Casablanca est bien renvoyée depuis le dataset statique.
    const casa = result.current.items.find((c) => c.slug === 'casablanca');
    expect(casa).toBeDefined();
    expect(casa?.nameFr).toBe('Casablanca');
  });

  it('flag=false avec q vide : top-N statique alphabétique', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    process.env.NEXT_PUBLIC_USE_DB_CITIES = 'false';

    const { result } = renderHook(() =>
      useDeliveryCities('', { debounceMs: 0, limit: 3 }),
    );

    await waitFor(() => {
      expect(result.current.items.length).toBe(3);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
