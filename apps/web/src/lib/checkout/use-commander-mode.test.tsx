/**
 * Kit CRO v2 §2 — `useCommanderMode` : branche `?cta=` et `fg_aid` sur la
 * résolution pure.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { search, getAnonymousId } = vi.hoisted(() => ({
  search: { value: '' },
  getAnonymousId: vi.fn(() => 'aid_fixture'),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search.value),
}));
vi.mock('@/lib/tracking/identity', () => ({ getAnonymousId }));

import { resolveCommanderMode } from './commander-mode';
import { useCommanderMode } from './use-commander-mode';

beforeEach(() => {
  search.value = '';
  getAnonymousId.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useCommanderMode', () => {
  it('réglage fixe : renvoie le mode sans lire le fg_aid', async () => {
    const { result } = renderHook(() => useCommanderMode({ cmsMode: 'sheet', sharePct: 50 }));
    await waitFor(() => expect(result.current).toBe('sheet'));
    expect(getAnonymousId).not.toHaveBeenCalled();
  });

  it('?cta=sheet force le panneau même si le réglage est scroll', async () => {
    search.value = 'cta=sheet&utm_source=meta';
    const { result } = renderHook(() => useCommanderMode({ cmsMode: 'scroll', sharePct: 0 }));
    await waitFor(() => expect(result.current).toBe('sheet'));
  });

  it('?cta=scroll force le défilement en A/B à 100 %', async () => {
    search.value = 'cta=scroll';
    const { result } = renderHook(() => useCommanderMode({ cmsMode: 'ab', sharePct: 100 }));
    await waitFor(() => expect(result.current).toBe('scroll'));
    expect(getAnonymousId).not.toHaveBeenCalled();
  });

  it('A/B : attribue via le fg_aid (même résultat que la fonction pure)', async () => {
    const { result } = renderHook(() => useCommanderMode({ cmsMode: 'ab', sharePct: 50 }));
    const expected = resolveCommanderMode({
      cmsMode: 'ab',
      sharePct: 50,
      visitorId: 'aid_fixture',
    });
    await waitFor(() => expect(result.current).toBe(expected));
    expect(getAnonymousId).toHaveBeenCalledTimes(1);
  });

  it('suit un changement de réglage', async () => {
    const { result, rerender } = renderHook(
      ({ cmsMode }: { cmsMode: 'scroll' | 'sheet' }) => useCommanderMode({ cmsMode, sharePct: 50 }),
      { initialProps: { cmsMode: 'scroll' } },
    );
    await waitFor(() => expect(result.current).toBe('scroll'));
    rerender({ cmsMode: 'sheet' });
    await waitFor(() => expect(result.current).toBe('sheet'));
  });
});
