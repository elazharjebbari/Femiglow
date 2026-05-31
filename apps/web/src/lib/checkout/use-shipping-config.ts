'use client';

/**
 * CHA-232 — Hook client `useShippingConfig()`.
 *
 * Fetch `/api/checkout/shipping-config` une fois au mount, expose
 * `{ freeShipping, loading }`. Cache mémoire global au module (évite
 * de re-fetch dans chaque composant qui en a besoin).
 *
 * Défaut optimiste : `freeShipping = true` avant la résolution du fetch —
 * cohérent avec la valeur par défaut côté serveur. Si l'admin a désactivé
 * l'offre, le 1er paint affichera "offerte" pendant ~200ms puis le vrai
 * prix une fois la config résolue (acceptable, non-destructif).
 */
import { useEffect, useState } from 'react';

interface ShippingConfigResponse {
  freeShipping: boolean;
}

type CacheState =
  | { kind: 'idle' }
  | { kind: 'loading'; promise: Promise<ShippingConfigResponse> }
  | { kind: 'ready'; value: ShippingConfigResponse };

let cache: CacheState = { kind: 'idle' };

const listeners = new Set<(value: ShippingConfigResponse) => void>();

function notify(value: ShippingConfigResponse) {
  for (const l of listeners) l(value);
}

async function fetchConfig(): Promise<ShippingConfigResponse> {
  try {
    const res = await fetch('/api/checkout/shipping-config', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as ShippingConfigResponse;
    const value: ShippingConfigResponse = {
      freeShipping: typeof data.freeShipping === 'boolean' ? data.freeShipping : true,
    };
    cache = { kind: 'ready', value };
    notify(value);
    return value;
  } catch {
    const fallback: ShippingConfigResponse = { freeShipping: true };
    cache = { kind: 'ready', value: fallback };
    notify(fallback);
    return fallback;
  }
}

function ensureLoaded() {
  if (cache.kind === 'idle') {
    const promise = fetchConfig();
    cache = { kind: 'loading', promise };
  }
}

export function useShippingConfig(): {
  freeShipping: boolean;
  loading: boolean;
} {
  const [value, setValue] = useState<ShippingConfigResponse>(() => {
    if (cache.kind === 'ready') return cache.value;
    return { freeShipping: true };
  });
  const [loading, setLoading] = useState<boolean>(() => cache.kind !== 'ready');

  useEffect(() => {
    ensureLoaded();
    if (cache.kind === 'ready') {
      setValue(cache.value);
      setLoading(false);
      return;
    }
    const listener = (next: ShippingConfigResponse) => {
      setValue(next);
      setLoading(false);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return { freeShipping: value.freeShipping, loading };
}

/**
 * Test-only : reset le cache module entre les tests. Ne pas appeler en prod.
 */
export function __resetShippingConfigCache() {
  cache = { kind: 'idle' };
  listeners.clear();
}
