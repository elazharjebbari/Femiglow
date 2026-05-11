import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, cleanup } from '@testing-library/react';
import { useOptimisticMutation } from './use-optimistic-mutation';

afterEach(() => cleanup());

function Harness<T extends unknown[], R>(props: {
  options: Parameters<typeof useOptimisticMutation<T, R>>[0];
  onState?: (state: ReturnType<typeof useOptimisticMutation<T, R>>) => void;
  capture?: (s: ReturnType<typeof useOptimisticMutation<T, R>>) => void;
}) {
  const state = useOptimisticMutation(props.options);
  props.capture?.(state);
  return null;
}

describe('useOptimisticMutation', () => {
  it('applique l\'update optimiste avant la résolution réseau', async () => {
    const events: string[] = [];
    let capturedRun: ((...args: unknown[]) => Promise<unknown>) | null = null;

    render(
      <Harness
        options={{
          mutate: async () => {
            events.push('network-start');
            await new Promise((r) => setTimeout(r, 10));
            events.push('network-end');
            return 'ok';
          },
          optimisticUpdate: () => {
            events.push('optimistic');
            return () => events.push('rollback');
          },
          onSuccess: () => events.push('success'),
        }}
        capture={(s) => {
          capturedRun = s.run as never;
        }}
      />,
    );

    await act(async () => {
      await capturedRun!();
    });
    expect(events[0]).toBe('optimistic');
    expect(events).toContain('success');
    expect(events).not.toContain('rollback');
  });

  it('rollback en cas d\'erreur', async () => {
    let capturedRun: ((...args: unknown[]) => Promise<unknown>) | null = null;
    const rollback = vi.fn();
    const onError = vi.fn();

    render(
      <Harness
        options={{
          mutate: async () => {
            throw new Error('boom');
          },
          optimisticUpdate: () => rollback,
          onError,
        }}
        capture={(s) => {
          capturedRun = s.run as never;
        }}
      />,
    );

    await act(async () => {
      await expect(capturedRun!()).rejects.toThrow('boom');
    });
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('empêche le double-submit en parallèle', async () => {
    let capturedRun: ((...args: unknown[]) => Promise<unknown>) | null = null;
    const mutate = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return 'ok';
    });

    render(
      <Harness
        options={{ mutate }}
        capture={(s) => {
          capturedRun = s.run as never;
        }}
      />,
    );

    await act(async () => {
      const p1 = capturedRun!();
      await expect(capturedRun!()).rejects.toThrow(/déjà en cours/);
      await p1;
    });
    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
