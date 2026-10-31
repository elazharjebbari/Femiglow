import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAddressReveal, type UseAddressRevealInput } from './use-address-reveal';

const empty: UseAddressRevealInput = { citySlug: null, cityText: '', addressDraft: '' };

describe('useAddressReveal', () => {
  it('fermé à l’arrivée', () => {
    expect(renderHook(() => useAddressReveal(empty)).result.current.revealed).toBe(false);
  });

  it('ville de la liste ou correspondance exacte : s’ouvre', () => {
    const { result, rerender } = renderHook((p) => useAddressReveal(p), { initialProps: empty });
    rerender({ ...empty, citySlug: 'casablanca', cityText: 'Casablanca' });
    expect(result.current.revealed).toBe(true);
  });

  it('ville hors liste : s’ouvre à la sortie du champ avec 2 caractères', () => {
    const { result } = renderHook(() => useAddressReveal(empty));
    act(() => result.current.onCityBlur('Ab'));
    expect(result.current.revealed).toBe(true);
  });

  it('1 caractère à la sortie du champ : reste fermé', () => {
    const { result } = renderHook(() => useAddressReveal(empty));
    act(() => result.current.onCityBlur(' A '));
    expect(result.current.revealed).toBe(false);
  });

  it('reprise de brouillon : ouvert d’emblée', () => {
    const byCity = { ...empty, cityText: 'Fès' };
    const byLine = { ...empty, addressDraft: 'Hay Salam' };
    expect(renderHook(() => useAddressReveal(byCity)).result.current.revealed).toBe(true);
    expect(renderHook(() => useAddressReveal(byLine)).result.current.revealed).toBe(true);
  });

  it('ne se referme jamais, même si la ville est effacée', () => {
    const { result, rerender } = renderHook((p) => useAddressReveal(p), {
      initialProps: { ...empty, citySlug: 'rabat', cityText: 'Rabat' } as UseAddressRevealInput,
    });
    rerender(empty);
    expect(result.current.revealed).toBe(true);
  });
});
