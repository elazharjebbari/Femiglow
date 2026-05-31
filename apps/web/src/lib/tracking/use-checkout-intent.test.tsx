/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCheckoutIntentTrigger } from './use-checkout-intent';
import type { WizardContext } from './checkout-events';

const emitMock = vi.fn();
vi.mock('./use-tracking', () => ({
  useTracking: () => ({ emit: emitMock, consent: { ad_storage: 'denied', analytics_storage: 'denied' } }),
}));

const ctx: WizardContext = {
  form_id: 'wizard_kit',
  form_mode: 'wizard_embed',
  step_name: 'lead',
  variant_key: null,
};

beforeEach(() => {
  emitMock.mockReset();
});

describe('useCheckoutIntentTrigger', () => {
  it('fire au 1er caractère saisi', () => {
    const { result } = renderHook(() => useCheckoutIntentTrigger({ ctx }));
    act(() => result.current.handleInputChange('firstName', 'Y'));
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(
      'checkout_intent',
      expect.objectContaining({ form_id: 'wizard_kit', step_name: 'lead', first_field: 'firstName' }),
      expect.objectContaining({ dedupKey: 'wizard_kit' }),
    );
  });

  it('ne fire PAS sur valeur vide', () => {
    const { result } = renderHook(() => useCheckoutIntentTrigger({ ctx }));
    act(() => result.current.handleInputChange('firstName', ''));
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('idempotence — 2 frappes successives → 1 seul emit', () => {
    const { result } = renderHook(() => useCheckoutIntentTrigger({ ctx }));
    act(() => result.current.handleInputChange('firstName', 'Y'));
    act(() => result.current.handleInputChange('firstName', 'Ya'));
    act(() => result.current.handleInputChange('phone', '0'));
    expect(emitMock).toHaveBeenCalledTimes(1);
  });

  it('reset() permet de re-fire', () => {
    const { result } = renderHook(() => useCheckoutIntentTrigger({ ctx }));
    act(() => result.current.handleInputChange('firstName', 'Y'));
    act(() => result.current.reset());
    act(() => result.current.handleInputChange('firstName', 'Z'));
    expect(emitMock).toHaveBeenCalledTimes(2);
  });

  it('inclut value + items quand fournis', () => {
    const items = [{ item_id: 'KIT', item_name: 'Kit FemiGlow', price: 199, quantity: 1 }];
    const { result } = renderHook(() =>
      useCheckoutIntentTrigger({ ctx, value: 199, items }),
    );
    act(() => result.current.handleInputChange('firstName', 'A'));
    expect(emitMock).toHaveBeenCalledWith(
      'checkout_intent',
      expect.objectContaining({ value: 199, items, currency: 'MAD' }),
      expect.anything(),
    );
  });
});
