// @vitest-environment jsdom
/**
 * F05 — useCampaignAutosave (CMP-F10) : debounce trailing (U-031/032),
 * optimistic-lock par rev, conflit figeant, flush immédiat, machine de statut.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useCampaignAutosave,
  type AutosaveSaveResult,
} from '../use-campaign-autosave';

function okResult(rev: number): AutosaveSaveResult {
  return { ok: true, rev, updatedAt: `2026-06-20T10:0${rev}:00.000Z` };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('F05 — useCampaignAutosave', () => {
  it('F05-U-031 — 1 frappe → 1 seul save après le debounce (2 s)', async () => {
    const save = vi.fn(async () => okResult(1));
    const { result } = renderHook(() => useCampaignAutosave({ save, debounceMs: 2000 }));

    act(() => result.current.schedule({ subject: 'a' }));
    await act(() => vi.advanceTimersByTimeAsync(1999));
    expect(save).not.toHaveBeenCalled(); // pas avant 2 s
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ subject: 'a', expectedRev: undefined });
    expect(result.current.status).toBe('saved');
    expect(result.current.savedAt).toBe('2026-06-20T10:01:00.000Z');
  });

  it('F05-U-032 — rafale : le timer se réarme, 1 save 2 s après la DERNIÈRE frappe (patch fusionné)', async () => {
    const save = vi.fn(async () => okResult(1));
    const { result } = renderHook(() => useCampaignAutosave({ save, debounceMs: 2000 }));

    act(() => result.current.schedule({ subject: 'a' }));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    act(() => result.current.schedule({ subject: 'ab' }));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    act(() => result.current.schedule({ preheader: 'p' }));
    expect(save).not.toHaveBeenCalled(); // réarmé à chaque frappe
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(save).toHaveBeenCalledTimes(1);
    // patch fusionné : dernière valeur de subject + preheader.
    expect(save).toHaveBeenCalledWith({ subject: 'ab', preheader: 'p', expectedRev: undefined });
  });

  it('optimistic-lock : le rev retourné est renvoyé en expectedRev au save suivant', async () => {
    const save = vi.fn(async () => okResult(3));
    const { result } = renderHook(() => useCampaignAutosave({ save, initialRev: 2, debounceMs: 100 }));

    act(() => result.current.schedule({ subject: 'a' }));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(save).toHaveBeenLastCalledWith({ subject: 'a', expectedRev: 2 });

    act(() => result.current.schedule({ subject: 'b' }));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(save).toHaveBeenLastCalledWith({ subject: 'b', expectedRev: 3 }); // rev mis à jour
  });

  it('conflit → statut "conflict" et FIGE l’autosave (jamais d’écrasement)', async () => {
    const save = vi.fn(async () => ({ ok: false, reason: 'conflict' }) as AutosaveSaveResult);
    const { result } = renderHook(() => useCampaignAutosave({ save, debounceMs: 100 }));

    act(() => result.current.schedule({ subject: 'a' }));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(result.current.status).toBe('conflict');

    // Toute frappe ultérieure est ignorée (pas de nouveau save).
    act(() => result.current.schedule({ subject: 'b' }));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('flush() : save immédiat sans attendre le debounce', async () => {
    const save = vi.fn(async () => okResult(1));
    const { result } = renderHook(() => useCampaignAutosave({ save, debounceMs: 5000 }));

    act(() => result.current.schedule({ subject: 'a' }));
    await act(async () => {
      await result.current.flush();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('saved');
  });

  it('flush() sans patch en attente = no-op', async () => {
    const save = vi.fn(async () => okResult(1));
    const { result } = renderHook(() => useCampaignAutosave({ save }));
    await act(async () => {
      await result.current.flush();
    });
    expect(save).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('échec serveur (throw) → statut "error" (pas de faux "saved")', async () => {
    const save = vi.fn(async () => {
      throw new Error('réseau');
    });
    const { result } = renderHook(() => useCampaignAutosave({ save, debounceMs: 100 }));
    act(() => result.current.schedule({ subject: 'a' }));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(result.current.status).toBe('error');
  });
});
