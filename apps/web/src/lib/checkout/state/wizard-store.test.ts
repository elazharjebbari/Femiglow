/**
 * CHA-231 — Tests du store wizard.
 *
 * Couvre :
 *  - Actions de mutation (setLeadId, setOrderId, goToStep, merge drafts,
 *    setLanguage, reset).
 *  - Sélecteurs (canProceed*, selectNextStep CHA-231 — address→thank_you,
 *    selectLanguage).
 *  - Migration v1 → v2 (suppression addressLine2/postalCode).
 *
 * On teste le `wizardStoreCreator` (sans persist) pour isoler la logique
 * pure du middleware Zustand.
 */
import { createStore } from 'zustand';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  DEFAULT_CONSENT_VERSION,
  migrateWizardState,
  selectCanProceedFromAddress,
  selectCanProceedFromLead,
  selectCanProceedFromPayment,
  selectLanguage,
  selectNextStep,
  selectPreviousStep,
  wizardStoreCreator,
  type WizardState,
} from './wizard-store';

function makeStore() {
  return createStore<WizardState>()(wizardStoreCreator);
}

describe('wizardStore — initial state', () => {
  it('démarre sur step=lead, leadId=null, orderId=null', () => {
    const s = makeStore().getState();
    expect(s.currentStep).toBe('lead');
    expect(s.leadId).toBeNull();
    expect(s.orderId).toBeNull();
    expect(s.hydrated).toBe(false);
  });

  it('addressDraft initial ne contient PAS addressLine2 ni postalCode', () => {
    const s = makeStore().getState();
    expect(s.addressDraft).not.toHaveProperty('addressLine2');
    expect(s.addressDraft).not.toHaveProperty('postalCode');
    expect(s.addressDraft.shippingMode).toBe('standard');
    expect(s.addressDraft.country).toBe('MA');
  });

  it('CHA-230 v3 : addressDraft initial expose les champs cached ville (null par défaut)', () => {
    const s = makeStore().getState();
    expect(s.addressDraft.citySlug).toBeNull();
    expect(s.addressDraft.cityNameAr).toBeNull();
    expect(s.addressDraft.cityDeliveryPriceMad).toBeNull();
    expect(s.addressDraft.cityDeliveryEta).toBeNull();
  });

  it('leadDraft contient le consentVersion par défaut', () => {
    const s = makeStore().getState();
    expect(s.leadDraft.consentVersion).toBe(DEFAULT_CONSENT_VERSION);
  });

  it('CHA-230 : leadDraft.consent vaut true par défaut (case pré-cochée)', () => {
    const s = makeStore().getState();
    expect(s.leadDraft.consent).toBe(true);
  });
});

describe('wizardStore — actions', () => {
  it('goToStep met à jour currentStep', () => {
    const store = makeStore();
    store.getState().goToStep('address');
    expect(store.getState().currentStep).toBe('address');
    store.getState().goToStep('thank_you');
    expect(store.getState().currentStep).toBe('thank_you');
  });

  it('mergeLeadDraft fusionne sans écraser les autres champs', () => {
    const store = makeStore();
    store.getState().mergeLeadDraft({ firstName: 'Amal' });
    expect(store.getState().leadDraft.firstName).toBe('Amal');
    expect(store.getState().leadDraft.consentVersion).toBe(
      DEFAULT_CONSENT_VERSION,
    );
    store.getState().mergeLeadDraft({ phone: '612345678', consent: true });
    expect(store.getState().leadDraft.firstName).toBe('Amal');
    expect(store.getState().leadDraft.phone).toBe('612345678');
    expect(store.getState().leadDraft.consent).toBe(true);
  });

  it('setLeadId et setOrderId persistent les ids serveur', () => {
    const store = makeStore();
    store.getState().setLeadId('cl_abc');
    store.getState().setOrderId('o_xyz');
    expect(store.getState().leadId).toBe('cl_abc');
    expect(store.getState().orderId).toBe('o_xyz');
  });

  it('setFormContext + setLanguage cohabitent', () => {
    const store = makeStore();
    store.getState().setFormContext({
      formId: 'wizard_kit',
      formMode: 'wizard_embed',
      variantKey: 'A',
      source: 'wizard_kit',
    });
    store.getState().setLanguage('ar');
    expect(store.getState().formContext?.language).toBe('ar');
    // Toggle FR
    store.getState().setLanguage('fr');
    expect(store.getState().formContext?.language).toBe('fr');
  });

  it("setLanguage sans formContext est un no-op silencieux", () => {
    const store = makeStore();
    store.getState().setLanguage('ar');
    expect(store.getState().formContext).toBeNull();
  });

  it('reset remet le store à neuf mais garde hydrated=true', () => {
    const store = makeStore();
    store.getState().setLeadId('cl_xyz');
    store.getState().goToStep('thank_you');
    store.getState().mergeAddressDraft({ city: 'Casablanca' });
    store.getState().reset();
    const s = store.getState();
    expect(s.leadId).toBeNull();
    expect(s.currentStep).toBe('lead');
    expect(s.addressDraft.city).toBe('');
    expect(s.hydrated).toBe(true);
  });
});

describe('wizardStore — selectors', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('selectCanProceedFromLead exige firstName ≥ 2, phone valide MA, consent', () => {
    // CHA-230 : consent vaut true par défaut, donc on le décoche au début
    // pour observer chaque précondition séparément.
    store.getState().mergeLeadDraft({ consent: false });
    expect(selectCanProceedFromLead(store.getState())).toBe(false);
    store.getState().mergeLeadDraft({ firstName: 'A' });
    expect(selectCanProceedFromLead(store.getState())).toBe(false); // firstName too short
    store.getState().mergeLeadDraft({ firstName: 'Amal', phone: '612345678' });
    expect(selectCanProceedFromLead(store.getState())).toBe(false); // missing consent
    store.getState().mergeLeadDraft({ consent: true });
    expect(selectCanProceedFromLead(store.getState())).toBe(true);
  });

  it('CHA-230 : décocher la case consent bloque la progression', () => {
    store.getState().mergeLeadDraft({ firstName: 'Amal', phone: '612345678' });
    // consent reste true par défaut → on peut avancer
    expect(selectCanProceedFromLead(store.getState())).toBe(true);
    // L'utilisateur la décoche explicitement → blocage immédiat
    store.getState().mergeLeadDraft({ consent: false });
    expect(selectCanProceedFromLead(store.getState())).toBe(false);
  });

  it('selectCanProceedFromLead rejette les phones non-MA (non [5-7]xxxxxxxx)', () => {
    store.getState().mergeLeadDraft({
      firstName: 'Amal',
      phone: '012345678',
      consent: true,
    });
    expect(selectCanProceedFromLead(store.getState())).toBe(false);
  });

  it('selectCanProceedFromAddress exige city ≥ 2 + addressLine1 ≥ 4', () => {
    expect(selectCanProceedFromAddress(store.getState())).toBe(false);
    store.getState().mergeAddressDraft({ city: 'Casa' });
    expect(selectCanProceedFromAddress(store.getState())).toBe(false);
    store.getState().mergeAddressDraft({ addressLine1: '12 rue' });
    expect(selectCanProceedFromAddress(store.getState())).toBe(true);
  });

  it('selectCanProceedFromPayment exige paymentMethod !== null', () => {
    expect(selectCanProceedFromPayment(store.getState())).toBe(false);
    store.getState().mergePaymentDraft({ paymentMethod: 'cod' });
    expect(selectCanProceedFromPayment(store.getState())).toBe(true);
  });

  it('selectNextStep — address mène directement à thank_you (CHA-231)', () => {
    store.getState().goToStep('address');
    expect(selectNextStep(store.getState())).toBe('thank_you');
  });

  it('selectNextStep — lead → address ; cart_review → lead', () => {
    store.getState().goToStep('lead');
    expect(selectNextStep(store.getState())).toBe('address');
    store.getState().goToStep('cart_review');
    expect(selectNextStep(store.getState())).toBe('lead');
  });

  it('selectNextStep — thank_you est terminal', () => {
    store.getState().goToStep('thank_you');
    expect(selectNextStep(store.getState())).toBeNull();
  });

  it('selectNextStep — payment legacy reste géré (rétro-compat)', () => {
    store.getState().goToStep('payment');
    expect(selectNextStep(store.getState())).toBe('thank_you');
  });

  it('selectPreviousStep — address → lead', () => {
    store.getState().goToStep('address');
    expect(selectPreviousStep(store.getState())).toBe('lead');
  });

  it('selectLanguage — défaut fr, override par formContext', () => {
    expect(selectLanguage(store.getState())).toBe('fr');
    store.getState().setFormContext({
      formId: 'wizard_kit',
      formMode: 'wizard_embed',
      variantKey: 'A',
      source: 'wizard_kit',
      language: 'ar',
    });
    expect(selectLanguage(store.getState())).toBe('ar');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Migrations persisted state
// ─────────────────────────────────────────────────────────────────────────────

describe('wizardStore — migrations persistées', () => {
  it('v1 → v2 : supprime addressLine2 + postalCode', () => {
    const v1 = {
      addressDraft: {
        city: 'Casablanca',
        addressLine1: '12 rue',
        addressLine2: 'apt 3', // legacy
        postalCode: '20000', // legacy
        country: 'MA',
        notes: '',
        shippingMode: 'standard',
      },
    };
    const out = migrateWizardState(v1, 1) as unknown as {
      addressDraft: Record<string, unknown>;
    };
    expect(out.addressDraft).not.toHaveProperty('addressLine2');
    expect(out.addressDraft).not.toHaveProperty('postalCode');
    expect(out.addressDraft.city).toBe('Casablanca');
  });

  it('v2 → v3 : additionne citySlug/cityNameAr/cityDeliveryPriceMad/cityDeliveryEta', () => {
    const v2 = {
      addressDraft: {
        city: 'Casablanca',
        addressLine1: '12 rue',
        country: 'MA',
        notes: '',
        shippingMode: 'standard',
      },
    };
    const out = migrateWizardState(v2, 2) as unknown as {
      addressDraft: Record<string, unknown>;
    };
    expect(out.addressDraft.city).toBe('Casablanca');
    expect(out.addressDraft.citySlug).toBeNull();
    expect(out.addressDraft.cityNameAr).toBeNull();
    expect(out.addressDraft.cityDeliveryPriceMad).toBeNull();
    expect(out.addressDraft.cityDeliveryEta).toBeNull();
  });

  it('v2 → v3 : tolère un state corrompu (types invalides → null)', () => {
    const v2 = {
      addressDraft: {
        city: 'Casablanca',
        addressLine1: '12 rue',
        country: 'MA',
        notes: '',
        shippingMode: 'standard',
        citySlug: 42, // type cassé
        cityDeliveryPriceMad: 'oups', // type cassé
        cityDeliveryEta: 999, // type cassé
        cityNameAr: { foo: 'bar' }, // type cassé
      },
    };
    const out = migrateWizardState(v2, 2) as unknown as {
      addressDraft: Record<string, unknown>;
    };
    expect(out.addressDraft.citySlug).toBeNull();
    expect(out.addressDraft.cityDeliveryPriceMad).toBeNull();
    expect(out.addressDraft.cityDeliveryEta).toBeNull();
    expect(out.addressDraft.cityNameAr).toBeNull();
  });

  it('v2 → v3 : préserve les valeurs valides existantes', () => {
    const v2 = {
      addressDraft: {
        city: 'Casablanca',
        addressLine1: '12 rue',
        country: 'MA',
        notes: '',
        shippingMode: 'standard',
        citySlug: 'casablanca',
        cityDeliveryPriceMad: 19,
        cityDeliveryEta: '24h',
        cityNameAr: 'الدار البيضاء',
      },
    };
    const out = migrateWizardState(v2, 2) as unknown as {
      addressDraft: Record<string, unknown>;
    };
    expect(out.addressDraft.citySlug).toBe('casablanca');
    expect(out.addressDraft.cityDeliveryPriceMad).toBe(19);
    expect(out.addressDraft.cityDeliveryEta).toBe('24h');
    expect(out.addressDraft.cityNameAr).toBe('الدار البيضاء');
  });

  it('v1 → v3 : enchaîne v1→v2 puis v2→v3', () => {
    const v1 = {
      addressDraft: {
        city: 'Casablanca',
        addressLine1: '12 rue',
        addressLine2: 'apt 3',
        postalCode: '20000',
        country: 'MA',
        notes: '',
        shippingMode: 'standard',
      },
    };
    const out = migrateWizardState(v1, 1) as unknown as {
      addressDraft: Record<string, unknown>;
    };
    // v1 → v2
    expect(out.addressDraft).not.toHaveProperty('addressLine2');
    expect(out.addressDraft).not.toHaveProperty('postalCode');
    // v2 → v3
    expect(out.addressDraft.citySlug).toBeNull();
    expect(out.addressDraft.cityNameAr).toBeNull();
    expect(out.addressDraft.cityDeliveryPriceMad).toBeNull();
    expect(out.addressDraft.cityDeliveryEta).toBeNull();
  });

  it('state corrompu (null) → retourne INITIAL', () => {
    const out = migrateWizardState(null, 1);
    expect(out.currentStep).toBe('lead');
    expect(out.leadId).toBeNull();
  });
});
