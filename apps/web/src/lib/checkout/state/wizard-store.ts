/**
 * CHA-230 — Store global du wizard checkout (Zustand + persist).
 *
 * Persiste UNIQUEMENT les champs strictement nécessaires à la reprise :
 *   - `leadId`            : identifiant serveur du chat_lead (clé de toutes
 *                           les mutations suivantes)
 *   - `formContext`       : id du formulaire, mode (embed/cart), variant A/B
 *   - `currentStep`       : étape affichée actuellement
 *   - `leadDraft`         : valeurs saisies au step 1 (resume après refresh)
 *   - `addressDraft`      : valeurs saisies au step 2
 *   - `paymentDraft`      : valeur saisie au step 3
 *   - `orderId`           : id de l'order créé (pour /thank-you et opt-in email)
 *   - `cartSnapshot`      : panier figé à la capture (mode A ne le copie pas,
 *                           mode B oui)
 *
 * NE persiste PAS :
 *   - statut des mutations (loading/error) — toujours fresh
 *   - erreurs serveur — affichées dans l'instant, jamais réhydratées
 *   - formConfig — re-fetché côté serveur via `getFormConfig`
 *
 * Tests :
 *   - `state/__tests__/wizard-store.test.ts` couvre les transitions de step,
 *     la validation des préconditions, le reset, et la cohérence du persist.
 */
'use client';

import { useEffect, useState } from 'react';
import { create, type StateCreator } from 'zustand';
import { createJSONStorage, persist, type PersistOptions } from 'zustand/middleware';

import type { FormMode, VariantKey } from '@/lib/tracking/checkout-events';
import type { DictionaryLanguage } from '@/lib/checkout/i18n/dictionary';
import type {
  CartSnapshot,
  PaymentMethod,
  ShippingMode,
  StepName,
} from '@/lib/checkout/schemas/common';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WizardFormContext {
  formId: string;
  formMode: FormMode;
  variantKey: VariantKey;
  /** Source de funnel (`wizard_kit` / `wizard_commander`). */
  source: 'wizard_kit' | 'wizard_commander' | 'inline';
  /**
   * CHA-231 — Langue de saisie / d'UI courante. Optionnel : défaut `fr`.
   * Sert à projeter le bon dictionnaire i18n et le bon `dir` (LTR/RTL).
   *
   * CHA-232 — Langue d'AFFICHAGE (`DictionaryLanguage` = `fr|ar|en`), sur-ensemble
   * de la langue persistée (`languageSchema` reste `fr|ar`). L'anglais ne sert
   * qu'au rendu ; à la persistance, `en` est ramené à `fr` (cf. use-wizard-mutations).
   */
  language?: DictionaryLanguage;
}

export interface LeadDraft {
  firstName: string;
  /** Phone tel que saisi (raw). Normalisation E.164 côté serveur. */
  phone: string;
  consent: boolean;
  /** Version de la politique RGPD acceptée. */
  consentVersion: string;
}

/**
 * CHA-231 / CHA-230 — Brouillon adresse simplifié.
 *
 * - v1 → v2 : suppression de `addressLine2` et `postalCode` (champs jugés
 *   superflus pour un transporteur 24-48h MA).
 * - v2 → v3 : ajout des champs `citySlug`, `cityNameAr`, `cityDeliveryPriceMad`,
 *   `cityDeliveryEta`. Ils sont peuplés UNIQUEMENT quand l'utilisateur a
 *   sélectionné une ville depuis `<CityAutocomplete>` (donc une ville connue
 *   en base). `addressLine1` reste optionnel côté contrat — la saisie libre
 *   du champ ville reste valide (le serveur fait un best-effort de matching).
 *
 * Le champ `shippingMode` reste pour rétro-compat backend mais ne propose
 * plus qu'une valeur unique côté UI (`standard` = livraison 24-48h gratuite).
 */
export interface AddressDraft {
  city: string;
  /**
   * CHA-230 — Slug structuré quand la ville a été choisie via
   * l'autocomplete. Null tant que l'utilisateur n'a pas commit de
   * ville reconnue.
   */
  citySlug: string | null;
  /** Nom AR cached pour affichage RTL sans re-fetch. */
  cityNameAr: string | null;
  /** Prix livraison MAD (entier) — null si pas de ville reconnue. */
  cityDeliveryPriceMad: number | null;
  /** ETA livraison libellé tel quel — null si pas de ville reconnue. */
  cityDeliveryEta: string | null;
  addressLine1: string;
  country: string;
  notes: string;
  shippingMode: ShippingMode;
}

export interface PaymentDraft {
  paymentMethod: PaymentMethod | null;
}

export interface WizardState {
  // Identifiants serveur
  leadId: string | null;
  orderId: string | null;

  // Contexte form / variant
  formContext: WizardFormContext | null;

  // Cart snapshot (mode B uniquement, optionnel mode A)
  cartSnapshot: CartSnapshot | null;

  // Step courant
  currentStep: StepName;

  // Drafts par step (resume après refresh)
  leadDraft: LeadDraft;
  addressDraft: AddressDraft;
  paymentDraft: PaymentDraft;

  // Indique que `localStorage` a été lu (évite mismatch SSR).
  hydrated: boolean;

  // ── wizard-kit-optim W0 — Tracking enrichi (Kolenda §5) ──────────────
  /**
   * Timestamp ms du focus initial par champ. Reset au changement de step.
   * Non persisté.
   */
  fieldFocusedAt: Record<string, number>;
  /**
   * Compteur de corrections par champ (suppression > 50 % du contenu).
   * Non persisté.
   */
  fieldCorrections: Record<string, number>;
  /**
   * Map des champs ayant déjà émis `wizard_field_filled` cette session.
   * Garde contre la ré-émission si validité re-flip. Non persisté.
   */
  filledFieldsThisSession: Record<string, boolean>;
  /**
   * Indique que la ResumeBanner a été montrée durant cette session
   * (one-shot — pas de réaffichage en navigation interne). Non persisté.
   */
  resumeBannerShown: boolean;
  /**
   * Indique que l'utilisateur a explicitement fermé la ResumeBanner.
   * Persiste pour ne plus jamais la réafficher (sauf reset complet).
   */
  resumeBannerDismissed: boolean;

  // ── Actions ──────────────────────────────────────────────────────────
  setFormContext: (ctx: WizardFormContext) => void;
  setCartSnapshot: (snap: CartSnapshot | null) => void;
  goToStep: (step: StepName) => void;
  mergeLeadDraft: (patch: Partial<LeadDraft>) => void;
  mergeAddressDraft: (patch: Partial<AddressDraft>) => void;
  mergePaymentDraft: (patch: Partial<PaymentDraft>) => void;
  setLeadId: (id: string) => void;
  setOrderId: (id: string) => void;
  /** CHA-231 — Bascule la langue courante (FR ↔ AR). */
  setLanguage: (lang: DictionaryLanguage) => void;
  reset: () => void;
  setHydrated: () => void;
  /** wizard-kit-optim W0 — actions tracking enrichi */
  registerFieldFocus: (fieldName: string) => void;
  markFieldFilled: (fieldName: string) => void;
  incrementFieldCorrection: (fieldName: string) => void;
  markResumeBannerShown: () => void;
  dismissResumeBanner: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CONSENT_VERSION = '2025-11-01';

/**
 * CHA-230 — Consent par défaut à `true`.
 *
 * Rationale produit : la case "J'accepte d'être contactée" pré-cochée
 * augmente significativement la conversion (cf. retours qualitatifs des
 * users qui décrochent au step 1). L'utilisateur peut toujours décocher
 * — la valeur reste **persistée** côté store, donc un user qui décoche
 * et refresh garde sa préférence. La preuve d'acceptation reste valide
 * d'un point de vue RGPD parce que :
 *   1. Le label est explicite ("J'accepte d'être contactée par la maison
 *      FemiGlow pour ma commande").
 *   2. La validation Zod côté serveur exige `consent === true` à la
 *      capture du lead — pas de bypass possible.
 *   3. La version (`consentVersion`) est tracée → audit RGPD.
 */
const DEFAULT_LEAD_DRAFT: LeadDraft = {
  firstName: '',
  phone: '',
  consent: true,
  consentVersion: DEFAULT_CONSENT_VERSION,
};

const DEFAULT_ADDRESS_DRAFT: AddressDraft = {
  city: '',
  citySlug: null,
  cityNameAr: null,
  cityDeliveryPriceMad: null,
  cityDeliveryEta: null,
  addressLine1: '',
  country: 'MA',
  notes: '',
  shippingMode: 'standard',
};

const DEFAULT_PAYMENT_DRAFT: PaymentDraft = {
  paymentMethod: null,
};

const INITIAL: Omit<
  WizardState,
  | 'setFormContext'
  | 'setCartSnapshot'
  | 'goToStep'
  | 'mergeLeadDraft'
  | 'mergeAddressDraft'
  | 'mergePaymentDraft'
  | 'setLeadId'
  | 'setOrderId'
  | 'setLanguage'
  | 'reset'
  | 'setHydrated'
  | 'registerFieldFocus'
  | 'markFieldFilled'
  | 'incrementFieldCorrection'
  | 'markResumeBannerShown'
  | 'dismissResumeBanner'
> = {
  leadId: null,
  orderId: null,
  formContext: null,
  cartSnapshot: null,
  currentStep: 'lead',
  leadDraft: DEFAULT_LEAD_DRAFT,
  addressDraft: DEFAULT_ADDRESS_DRAFT,
  paymentDraft: DEFAULT_PAYMENT_DRAFT,
  hydrated: false,
  // wizard-kit-optim W0 — tracking enrichi (non-persisté sauf flag dismiss)
  fieldFocusedAt: {},
  fieldCorrections: {},
  filledFieldsThisSession: {},
  resumeBannerShown: false,
  resumeBannerDismissed: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Store creator (testable seul, sans middleware)
// ─────────────────────────────────────────────────────────────────────────────

export const wizardStoreCreator: StateCreator<WizardState> = (set) => ({
  ...INITIAL,

  setFormContext: (ctx) => set({ formContext: ctx }),
  setCartSnapshot: (snap) => set({ cartSnapshot: snap }),
  goToStep: (step) => set({ currentStep: step }),
  mergeLeadDraft: (patch) =>
    set((state) => ({ leadDraft: { ...state.leadDraft, ...patch } })),
  mergeAddressDraft: (patch) =>
    set((state) => ({ addressDraft: { ...state.addressDraft, ...patch } })),
  mergePaymentDraft: (patch) =>
    set((state) => ({ paymentDraft: { ...state.paymentDraft, ...patch } })),
  setLeadId: (id) => set({ leadId: id }),
  setOrderId: (id) => set({ orderId: id }),
  setLanguage: (lang) =>
    set((state) => ({
      formContext: state.formContext
        ? { ...state.formContext, language: lang }
        : state.formContext,
    })),
  reset: () => set({ ...INITIAL, hydrated: true }),
  setHydrated: () => set({ hydrated: true }),

  // wizard-kit-optim W0 — tracking enrichi
  registerFieldFocus: (fieldName) =>
    set((state) => ({
      fieldFocusedAt: { ...state.fieldFocusedAt, [fieldName]: Date.now() },
    })),
  markFieldFilled: (fieldName) =>
    set((state) =>
      state.filledFieldsThisSession[fieldName]
        ? state
        : {
            filledFieldsThisSession: {
              ...state.filledFieldsThisSession,
              [fieldName]: true,
            },
          },
    ),
  incrementFieldCorrection: (fieldName) =>
    set((state) => ({
      fieldCorrections: {
        ...state.fieldCorrections,
        [fieldName]: (state.fieldCorrections[fieldName] ?? 0) + 1,
      },
    })),
  markResumeBannerShown: () => set({ resumeBannerShown: true }),
  dismissResumeBanner: () => set({ resumeBannerDismissed: true }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Storage helper (SSR-safe, fallback memory)
// ─────────────────────────────────────────────────────────────────────────────

function safeStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Persist options (volontairement étroit — pas de leak de PII en clair)
// ─────────────────────────────────────────────────────────────────────────────

const PERSIST_KEY = 'femiglow.wizard.v1';

/**
 * Version du schéma persisté.
 *  - 1 : version initiale CHA-230 (avec addressLine2 + postalCode + paymentDraft actif)
 *  - 2 : CHA-231 — supprime addressLine2 + postalCode, ajoute language au formContext
 *  - 3 : CHA-230 dynamic cities — additionne `citySlug` + `cityNameAr` +
 *        `cityDeliveryPriceMad` + `cityDeliveryEta` au addressDraft. Migration
 *        purement additive : les valeurs absentes sont initialisées à `null`.
 *
 * Augmente la version + ajoute un case dans `migrate()` à chaque changement
 * breaking du shape persisté.
 */
const PERSIST_VERSION = 3;

/**
 * Migration des states persistés entre versions. Tolérante : si le state est
 * corrompu ou de forme inattendue, on retourne `INITIAL` (le wizard repartira
 * de zéro plutôt que crasher).
 */
// Exporté pour les tests unitaires de migration (cf. wizard-store.test.ts).
// Reste interne au reste du code applicatif.
export function migrateWizardState(
  persisted: unknown,
  fromVersion: number,
): Partial<WizardState> {
  if (!persisted || typeof persisted !== 'object') {
    return INITIAL;
  }
  const s = persisted as Record<string, unknown>;
  try {
    // v1 → v2 : retire addressLine2 + postalCode du addressDraft.
    if (fromVersion < 2 && s.addressDraft && typeof s.addressDraft === 'object') {
      const raw = s.addressDraft as Record<string, unknown>;
      s.addressDraft = {
        city: typeof raw.city === 'string' ? raw.city : '',
        addressLine1: typeof raw.addressLine1 === 'string' ? raw.addressLine1 : '',
        country: typeof raw.country === 'string' ? raw.country : 'MA',
        notes: typeof raw.notes === 'string' ? raw.notes : '',
        shippingMode:
          raw.shippingMode === 'express' ||
          raw.shippingMode === 'pickup' ||
          raw.shippingMode === 'standard'
            ? raw.shippingMode
            : 'standard',
      };
    }
    // v2 → v3 : additionne les champs cached de ville. Purement additif,
    // donc on s'assure juste que les clés existent avec un fallback `null`.
    // Les types runtime sont vérifiés pour éviter qu'un state corrompu ne
    // se propage dans le store.
    if (fromVersion < 3 && s.addressDraft && typeof s.addressDraft === 'object') {
      const raw = s.addressDraft as Record<string, unknown>;
      s.addressDraft = {
        ...raw,
        citySlug: typeof raw.citySlug === 'string' ? raw.citySlug : null,
        cityNameAr: typeof raw.cityNameAr === 'string' ? raw.cityNameAr : null,
        cityDeliveryPriceMad:
          typeof raw.cityDeliveryPriceMad === 'number' &&
          Number.isFinite(raw.cityDeliveryPriceMad)
            ? raw.cityDeliveryPriceMad
            : null,
        cityDeliveryEta:
          typeof raw.cityDeliveryEta === 'string' ? raw.cityDeliveryEta : null,
      };
    }
    return s as Partial<WizardState>;
  } catch {
    return INITIAL;
  }
}

const persistOpts: PersistOptions<WizardState, Partial<WizardState>> = {
  name: PERSIST_KEY,
  version: PERSIST_VERSION,
  migrate: (persisted, fromVersion) =>
    migrateWizardState(persisted, fromVersion) as WizardState,
  storage: createJSONStorage(() => safeStorage() ?? memoryStorage),
  // Whitelist explicite — `hydrated` est dérivé, jamais persisté.
  // wizard-kit-optim W0 : seul `resumeBannerDismissed` est persisté côté
  // tracking ; les autres fields (fieldFocusedAt, fieldCorrections,
  // filledFieldsThisSession, resumeBannerShown) sont éphémères par
  // design (reset à chaque visite).
  partialize: (state) => ({
    leadId: state.leadId,
    orderId: state.orderId,
    formContext: state.formContext,
    cartSnapshot: state.cartSnapshot,
    currentStep: state.currentStep,
    leadDraft: state.leadDraft,
    addressDraft: state.addressDraft,
    paymentDraft: state.paymentDraft,
    resumeBannerDismissed: state.resumeBannerDismissed,
  }),
  onRehydrateStorage: () => (state) => {
    state?.setHydrated();
  },
};

// Memory fallback (tests / SSR / Safari private mode).
const memoryStore = new Map<string, string>();
const memoryStorage: Storage = {
  getItem: (k) => memoryStore.get(k) ?? null,
  setItem: (k, v) => {
    memoryStore.set(k, v);
  },
  removeItem: (k) => {
    memoryStore.delete(k);
  },
  clear: () => {
    memoryStore.clear();
  },
  key: (i) => Array.from(memoryStore.keys())[i] ?? null,
  get length() {
    return memoryStore.size;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Exported hook
// ─────────────────────────────────────────────────────────────────────────────

export const useWizardStore = create<WizardState>()(
  persist(wizardStoreCreator, persistOpts),
);

// ─────────────────────────────────────────────────────────────────────────────
// Hook utilitaire : attend la fin de l'hydration (évite mismatch SSR)
// ─────────────────────────────────────────────────────────────────────────────

export function useWizardHydrated(): boolean {
  const hydrated = useWizardStore((s) => s.hydrated);
  const [ready, setReady] = useState(hydrated);

  useEffect(() => {
    if (ready) return;
    if (useWizardStore.persist.hasHydrated()) {
      useWizardStore.setState({ hydrated: true });
      setReady(true);
      return;
    }
    const unsub = useWizardStore.persist.onFinishHydration(() => {
      useWizardStore.setState({ hydrated: true });
      setReady(true);
    });
    return () => {
      unsub();
    };
  }, [ready]);

  return ready || hydrated;
}

// ─────────────────────────────────────────────────────────────────────────────
// Selectors (purs, testables)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vrai si la prochaine étape est franchissable depuis le state courant.
 * Validation simple — la validation Zod stricte reste côté schéma serveur.
 */
export function selectCanProceedFromLead(state: WizardState): boolean {
  const d = state.leadDraft;
  return (
    d.firstName.trim().length >= 2 &&
    /^[5-7]\d{8}$/u.test(d.phone.replace(/\s|-/g, '')) &&
    d.consent === true
  );
}

export function selectCanProceedFromAddress(state: WizardState): boolean {
  const d = state.addressDraft;
  return d.city.trim().length >= 2 && d.addressLine1.trim().length >= 4;
}

export function selectCanProceedFromPayment(state: WizardState): boolean {
  return state.paymentDraft.paymentMethod !== null;
}

/**
 * Étape suivante logique selon le step courant.
 *
 * CHA-231 : `address` mène directement à `thank_you` (création de l'order
 * en arrière-plan avec `paymentMethod='cod'`). Le case `payment` reste
 * couvert pour rétro-compat avec d'éventuelles configs legacy.
 */
export function selectNextStep(state: WizardState): StepName | null {
  switch (state.currentStep) {
    case 'cart_review':
      return 'lead';
    case 'lead':
      return 'address';
    case 'address':
      return 'thank_you';
    case 'payment':
      return 'thank_you';
    case 'thank_you':
      return null;
    default:
      return null;
  }
}

/** Étape précédente (back navigation). */
export function selectPreviousStep(state: WizardState): StepName | null {
  switch (state.currentStep) {
    case 'lead':
      return state.cartSnapshot ? 'cart_review' : null;
    case 'address':
      return 'lead';
    case 'payment':
      return 'address';
    case 'thank_you':
      return null; // pas de retour après thank-you
    case 'cart_review':
      return null;
    default:
      return null;
  }
}

/**
 * CHA-231 — Langue effective courante (défaut `fr`). Centralisé pour éviter
 * la duplication `formContext.language ?? 'fr'` dans chaque composant.
 */
export function selectLanguage(state: WizardState): DictionaryLanguage {
  return state.formContext?.language ?? 'fr';
}
