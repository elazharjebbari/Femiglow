/** FE-S1 — actions crédit fidélité du wizard-store (Phase 3). */
import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand';
import { wizardStoreCreator, type WizardState } from './wizard-store';

function freshStore() {
  return createStore<WizardState>(wizardStoreCreator);
}

describe('FE-S1 wizard-store coupon', () => {
  it('U001 défauts : couponCode null, creditCents 0', () => {
    const s = freshStore().getState();
    expect(s.couponCode).toBeNull();
    expect(s.creditCents).toBe(0);
  });

  it('U002 setCoupon normalise (upper/trim) et stocke le crédit', () => {
    const store = freshStore();
    store.getState().setCoupon('  fg-abc234 ', 2000);
    expect(store.getState().couponCode).toBe('FG-ABC234');
    expect(store.getState().creditCents).toBe(2000);
  });

  it('U003 setCoupon plancher crédit à 0 (jamais négatif)', () => {
    const store = freshStore();
    store.getState().setCoupon('FG-XXX', -50);
    expect(store.getState().creditCents).toBe(0);
  });

  it('U004 clearCoupon réinitialise code et crédit', () => {
    const store = freshStore();
    store.getState().setCoupon('FG-ABC234', 2000);
    store.getState().clearCoupon();
    expect(store.getState().couponCode).toBeNull();
    expect(store.getState().creditCents).toBe(0);
  });
});
