/**
 * Store Zustand du wizard Tracking Plan v2.
 *
 * Persiste un draft local (sessionStorage) pour permettre la reprise après refresh
 * sans pousser le brouillon au serveur tant que l'utilisateur n'a pas cliqué « Enregistrer ».
 *
 * Étapes :
 *   1. providers     : sélection des outils actifs (toggle on/off)
 *   2. envProfiles   : IDs par environnement (production obligatoire)
 *   3. events        : matrice événements × outils
 *   4. settings      : Consent Mode v2 + defaults
 *   5. review        : récap + activation
 *
 * Pas de mutation directe du serveur ici. Les composants appellent
 * `trackingPlanApi.create()` / `trackingPlanApi.update(..., If-Match)` puis
 * `resetDraft()` pour repartir d'une session vierge.
 */
'use client';

import { create, type StateCreator } from 'zustand';
import { createJSONStorage, persist, type PersistOptions } from 'zustand/middleware';
import type {
  EnvProfile,
  PlanSettings,
  Provider,
  TrackingEvent,
  TrackingPlanInput,
} from '../types';

export type WizardStep = 'providers' | 'envProfiles' | 'events' | 'settings' | 'review';

export const WIZARD_STEPS: readonly WizardStep[] = [
  'providers',
  'envProfiles',
  'events',
  'settings',
  'review',
] as const;

interface WizardState {
  step: WizardStep;
  draft: TrackingPlanInput;
  dirty: boolean;
  lastSavedAt: string | null;
  // actions
  setStep(step: WizardStep): void;
  nextStep(): void;
  previousStep(): void;
  patchDraft(patch: Partial<TrackingPlanInput>): void;
  setProviders(providers: Provider[]): void;
  setEnvProfiles(profiles: EnvProfile[]): void;
  setEvents(events: TrackingEvent[]): void;
  setSettings(settings: PlanSettings): void;
  markSaved(): void;
  resetDraft(): void;
  hydrateFromPlan(draft: TrackingPlanInput): void;
}

const EMPTY_DRAFT: TrackingPlanInput = {
  name: '',
  providers: [
    { id: 'ga4', active: true },
    { id: 'googleAds', active: false },
    { id: 'meta', active: false },
    { id: 'tiktok', active: false },
    { id: 'gtm', active: false },
  ],
  envProfiles: [{ env: 'production', config: {} }],
  events: [],
  settings: {},
};

function indexOfStep(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step);
}

const wizardCreator: StateCreator<WizardState> = (set) => ({
  step: 'providers',
  draft: structuredClone(EMPTY_DRAFT),
  dirty: false,
  lastSavedAt: null,

  setStep: (step) => set({ step }),
  nextStep: () =>
    set((s) => {
      const idx = indexOfStep(s.step);
      const next = WIZARD_STEPS[Math.min(idx + 1, WIZARD_STEPS.length - 1)]!;
      return { step: next };
    }),
  previousStep: () =>
    set((s) => {
      const idx = indexOfStep(s.step);
      const prev = WIZARD_STEPS[Math.max(idx - 1, 0)]!;
      return { step: prev };
    }),

  patchDraft: (patch) =>
    set((s) => ({ draft: { ...s.draft, ...patch }, dirty: true })),
  setProviders: (providers) =>
    set((s) => ({ draft: { ...s.draft, providers }, dirty: true })),
  setEnvProfiles: (envProfiles) =>
    set((s) => ({ draft: { ...s.draft, envProfiles }, dirty: true })),
  setEvents: (events) =>
    set((s) => ({ draft: { ...s.draft, events }, dirty: true })),
  setSettings: (settings) =>
    set((s) => ({ draft: { ...s.draft, settings }, dirty: true })),

  markSaved: () => set({ dirty: false, lastSavedAt: new Date().toISOString() }),
  resetDraft: () =>
    set({
      step: 'providers',
      draft: structuredClone(EMPTY_DRAFT),
      dirty: false,
      lastSavedAt: null,
    }),
  hydrateFromPlan: (draft) =>
    set({
      step: 'providers',
      draft: structuredClone(draft),
      dirty: false,
      lastSavedAt: null,
    }),
});

const persistOptions: PersistOptions<WizardState> = {
  name: 'tracking-plan-wizard',
  storage: createJSONStorage(() =>
    typeof window === 'undefined' ? mockStorage() : window.sessionStorage,
  ),
  partialize: (state) =>
    ({
      step: state.step,
      draft: state.draft,
      dirty: state.dirty,
      lastSavedAt: state.lastSavedAt,
    }) as unknown as WizardState,
};

function mockStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

export const useWizardStore = create<WizardState>()(persist(wizardCreator, persistOptions));

export { EMPTY_DRAFT };
