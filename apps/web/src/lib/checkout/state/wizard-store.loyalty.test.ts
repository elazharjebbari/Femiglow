/**
 * F13 — wizard-store : crédit + code de fidélité émis + contrat de persistance.
 *
 * Couvre setLoyalty, le clamp du crédit et surtout le `partialize` : on persiste
 * `couponCode` + `loyalty` (reprise) mais JAMAIS `creditCents` (re-validé, serveur
 * autoritaire). cf. docs/coupon-loyalty-qa-ui-2026-06-03/13-wizard-store.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createStore } from 'zustand';
import { wizardStoreCreator, useWizardStore, type WizardState } from './wizard-store';

const PERSIST_KEY = 'femiglow.wizard.v1';

function freshStore() {
  return createStore<WizardState>(wizardStoreCreator);
}

describe('F13 wizard-store loyalty', () => {
  it('F13-U001 setLoyalty stocke le code émis', () => {
    const store = freshStore();
    store.getState().setLoyalty({ code: 'FG-SAUGE-7212', valueCents: 2000, activatesAt: '2026-06-10' });
    expect(store.getState().loyalty).toEqual({ code: 'FG-SAUGE-7212', valueCents: 2000, activatesAt: '2026-06-10' });
  });

  it('F13-U002 setLoyalty(null) efface', () => {
    const store = freshStore();
    store.getState().setLoyalty({ code: 'X', valueCents: 1, activatesAt: null });
    store.getState().setLoyalty(null);
    expect(store.getState().loyalty).toBeNull();
  });

  it('F13-U003 reset() repart à loyalty=null + couponCode=null', () => {
    const store = freshStore();
    store.getState().setCoupon('FG-AAA111', 2000);
    store.getState().setLoyalty({ code: 'X', valueCents: 1, activatesAt: null });
    store.getState().reset();
    expect(store.getState().loyalty).toBeNull();
    expect(store.getState().couponCode).toBeNull();
    expect(store.getState().creditCents).toBe(0);
  });

  it('F13-U004 setCoupon arrondit le crédit (centimes entiers)', () => {
    const store = freshStore();
    store.getState().setCoupon('FG-AAA111', 1999.6);
    expect(store.getState().creditCents).toBe(2000);
  });

  describe('contrat de persistance (partialize)', () => {
    beforeEach(() => {
      localStorage.clear();
      useWizardStore.getState().reset();
    });

    it('F13-U005 persiste couponCode + loyalty mais PAS creditCents', () => {
      useWizardStore.getState().setCoupon('FG-AAA111', 2500);
      useWizardStore.getState().setLoyalty({ code: 'FG-SAUGE-7212', valueCents: 2000, activatesAt: '2026-06-10' });
      const raw = JSON.parse(localStorage.getItem(PERSIST_KEY) ?? '{}');
      expect(raw.state.couponCode).toBe('FG-AAA111');
      expect(raw.state.loyalty?.code).toBe('FG-SAUGE-7212');
      expect(raw.state).not.toHaveProperty('creditCents');
    });

    it('F13-U006 ne persiste aucun montant de crédit en clair (re-validation forcée)', () => {
      useWizardStore.getState().setCoupon('FG-AAA111', 2500);
      const raw = localStorage.getItem(PERSIST_KEY) ?? '';
      expect(raw).not.toContain('"creditCents"');
    });
  });
});
