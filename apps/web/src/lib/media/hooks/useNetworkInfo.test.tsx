import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNetworkInfo } from './useNetworkInfo';

const original = (navigator as unknown as { connection?: unknown }).connection;

afterEach(() => {
  Object.defineProperty(navigator, 'connection', { configurable: true, value: original });
});

describe('useNetworkInfo', () => {
  it('renvoie défauts si navigator.connection absent', () => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: undefined });
    const { result } = renderHook(() => useNetworkInfo());
    expect(result.current.effectiveType).toBe('unknown');
    expect(result.current.saveData).toBe(false);
  });

  it('lit effectiveType, saveData, downlink quand dispo', () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: {
        effectiveType: '4g',
        saveData: true,
        downlink: 5,
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
    const { result } = renderHook(() => useNetworkInfo());
    expect(result.current.effectiveType).toBe('4g');
    expect(result.current.saveData).toBe(true);
    expect(result.current.downlink).toBe(5);
  });
});
