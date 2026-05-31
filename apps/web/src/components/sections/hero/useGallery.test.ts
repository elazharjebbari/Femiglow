import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGallery } from './useGallery';

describe('useGallery', () => {
  it('initialise currentIndex à 0 par défaut', () => {
    const { result } = renderHook(() => useGallery({ count: 5 }));
    expect(result.current.currentIndex).toBe(0);
  });

  it('respecte initialIndex valide', () => {
    const { result } = renderHook(() => useGallery({ count: 5, initialIndex: 2 }));
    expect(result.current.currentIndex).toBe(2);
  });

  it('clamp initialIndex > count-1', () => {
    const { result } = renderHook(() => useGallery({ count: 3, initialIndex: 10 }));
    expect(result.current.currentIndex).toBe(2);
  });

  it('clamp initialIndex négatif', () => {
    const { result } = renderHook(() => useGallery({ count: 4, initialIndex: -5 }));
    expect(result.current.currentIndex).toBe(0);
  });

  it("next() wrap à 0 après le dernier", () => {
    const { result } = renderHook(() => useGallery({ count: 3, initialIndex: 2 }));
    act(() => result.current.next());
    expect(result.current.currentIndex).toBe(0);
  });

  it('prev() wrap au dernier depuis 0', () => {
    const { result } = renderHook(() => useGallery({ count: 3, initialIndex: 0 }));
    act(() => result.current.prev());
    expect(result.current.currentIndex).toBe(2);
  });

  it('setIndex hors borne wrap (cyclic)', () => {
    const { result } = renderHook(() => useGallery({ count: 4 }));
    act(() => result.current.setIndex(7));
    // 7 % 4 = 3
    expect(result.current.currentIndex).toBe(3);
  });

  it('setIndex négatif wrap correctement', () => {
    const { result } = renderHook(() => useGallery({ count: 4 }));
    act(() => result.current.setIndex(-1));
    expect(result.current.currentIndex).toBe(3);
  });

  it('count=0 ne crash pas et reste à 0', () => {
    const { result } = renderHook(() => useGallery({ count: 0 }));
    expect(result.current.currentIndex).toBe(0);
    act(() => result.current.next());
    expect(result.current.currentIndex).toBe(0);
    act(() => result.current.prev());
    expect(result.current.currentIndex).toBe(0);
  });

  it('next/prev répétés cyclent proprement', () => {
    const { result } = renderHook(() => useGallery({ count: 3 }));
    expect(result.current.currentIndex).toBe(0);
    act(() => result.current.next()); // 1
    act(() => result.current.next()); // 2
    act(() => result.current.next()); // 0
    expect(result.current.currentIndex).toBe(0);
    act(() => result.current.prev()); // 2
    expect(result.current.currentIndex).toBe(2);
  });
});
