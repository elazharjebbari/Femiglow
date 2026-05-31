import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const emitSpy = vi.fn();

vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitSpy }),
}));

import { ViewItemTracker } from './ViewItemTracker';

beforeEach(() => {
  emitSpy.mockClear();
  cleanup();
});

describe('ViewItemTracker', () => {
  it('emits view_item on mount with item params', () => {
    render(
      <ViewItemTracker itemId="kit" itemName="Le pack FemiGlow" priceCents={32000} />,
    );
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(
      'view_item',
      {
        currency: 'MAD',
        value: 320,
        items: [{ item_id: 'kit', item_name: 'Le pack FemiGlow', price: 320, quantity: 1 }],
      },
      undefined,
    );
  });

  it('passes eventIdOverride when eventIdSeed prop is provided', () => {
    const seed = 'a'.repeat(32);
    render(
      <ViewItemTracker
        itemId="kit"
        itemName="Le pack FemiGlow"
        priceCents={32000}
        eventIdSeed={seed}
      />,
    );
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenLastCalledWith(
      'view_item',
      expect.any(Object),
      { eventIdOverride: seed },
    );
  });

  it('does NOT re-emit on remount with the same itemId (idempotence)', () => {
    const { rerender } = render(
      <ViewItemTracker itemId="kit" itemName="A" priceCents={32000} />,
    );
    rerender(<ViewItemTracker itemId="kit" itemName="A" priceCents={32000} />);
    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('re-emits when itemId changes', () => {
    const { rerender } = render(
      <ViewItemTracker itemId="kit" itemName="A" priceCents={32000} />,
    );
    rerender(<ViewItemTracker itemId="rituel" itemName="B" priceCents={25000} />);
    expect(emitSpy).toHaveBeenCalledTimes(2);
  });

  it('honors custom currency and category', () => {
    render(
      <ViewItemTracker
        itemId="kit"
        itemName="Le pack"
        priceCents={32000}
        currency="USD"
        category="cosmetics"
      />,
    );
    expect(emitSpy).toHaveBeenCalledWith(
      'view_item',
      expect.objectContaining({
        currency: 'USD',
        items: [expect.objectContaining({ category: 'cosmetics' })],
      }),
      undefined,
    );
  });
});
