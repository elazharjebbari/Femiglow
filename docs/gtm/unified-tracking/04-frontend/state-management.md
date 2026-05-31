# State Management — useTrackingPlanStore

## 1. Vue d'ensemble

Un seul store Zustand pour gérer l'édition d'un plan côté admin.

```ts
// apps/web/src/components/admin/tracking/plan/store.ts

interface TrackingPlanStoreState {
  // Identité du plan édité
  planId: string | null;
  isLoading: boolean;
  loadError: string | null;

  // Le draft local (mutable)
  plan: TrackingPlan | null;
  serverBundleId: string | null;
  localBundleId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: string | null;

  // Wizard state
  currentStep: 1 | 2 | 3 | 4 | 5;
  visitedSteps: Set<number>;

  // Validation
  validationResult: ValidationResult | null;

  // Mode (wizard | expert)
  mode: 'wizard' | 'expert';

  // Actions
  load: (id: string) => Promise<void>;
  setStep: (step: number) => void;
  toggleMode: () => void;
  updateField: (path: string, value: unknown) => void;
  resetDraft: () => void;
  save: () => Promise<void>;
  validateNow: () => Promise<ValidationResult>;
  activate: () => Promise<void>;
  archive: () => Promise<void>;
}
```

## 2. Invariants

| # | Invariant | Garantie |
|---|---|---|
| 1 | Un seul plan édité à la fois | Store global mais un seul `planId` actif |
| 2 | `isDirty` exact | Comparaison `localBundleId !== serverBundleId` |
| 3 | Persistence atomique | Zustand `persist` avec migration explicite |
| 4 | Pas d'activation sans save | `activate()` appelle `save()` d'abord si dirty |
| 5 | Validation à chaque update | `updateField` planifie un `validateNow()` debounced |

## 3. Persistence localStorage

```ts
export const useTrackingPlanStore = create<TrackingPlanStoreState>()(
  persist(
    (set, get) => ({
      // ... state initial
    }),
    {
      name: 'femiglow.tracking-plan-draft.v1',
      version: 1,
      partialize: (state) => ({
        // Sauve uniquement le draft client (jamais les tokens)
        planId: state.planId,
        plan: state.plan ? stripSecrets(state.plan) : null,
        currentStep: state.currentStep,
        mode: state.mode,
      }),
      migrate: (persistedState, version) => {
        // Migration entre versions du store (futur)
        return persistedState as TrackingPlanStoreState;
      },
    },
  ),
);

function stripSecrets(plan: TrackingPlan): TrackingPlan {
  return produce(plan, (draft) => {
    if (draft.providers.meta) draft.providers.meta.capiToken = '';
    if (draft.providers.tiktok) draft.providers.tiktok.accessToken = '';
    if (draft.providers.ga4) draft.providers.ga4.apiSecret = '';
  });
}
```

**Pourquoi `stripSecrets`** : éviter de stocker les tokens en localStorage. À la reprise, les champs secrets sont vides — l'admin doit les ressaisir (ou la dernière valeur serveur reste). UX : afficher un indicateur "Token non synchronisé localement".

## 4. Auto-save pattern

```ts
const SAVE_DEBOUNCE_MS = 5000;

updateField: (path, value) => {
  set(produce(state => {
    set_at_path(state.plan, path, value);
    state.localBundleId = computeBundleId(state.plan);
    state.isDirty = state.localBundleId !== state.serverBundleId;
  }));
  get().scheduleAutoSave();
  get().scheduleValidate();
},

scheduleAutoSave: debounce(async () => {
  const s = get();
  if (s.isDirty && !s.isSaving) {
    await s.save();
  }
}, SAVE_DEBOUNCE_MS),

scheduleValidate: debounce(async () => {
  await get().validateNow();
}, 300),
```

**UX :** indicateur discret en haut à droite "Sauvegardé il y a 3s" / "Sauvegarde…". Pas de toast à chaque save (trop bruyant).

## 5. Activation flow

```ts
activate: async () => {
  const s = get();

  // 1. Save préalable si dirty
  if (s.isDirty) await s.save();

  // 2. Validation côté client (early UX)
  const validation = await s.validateNow();
  if (!validation.ok) {
    set({ validationResult: validation });
    throw new ClientValidationError('Validation failed', validation);
  }

  // 3. Confirmation modal (déclenchée par UI)
  // ... handled by component

  // 4. Server activate
  set({ isSaving: true });
  try {
    const result = await api.plans.activate(s.planId!);
    set({
      plan: result.plan.plan,
      serverBundleId: result.bundleId,
      localBundleId: result.bundleId,
      isDirty: false,
      isSaving: false,
      lastSavedAt: new Date().toISOString(),
    });
    // Toast succès + redirect home
  } catch (err) {
    set({ isSaving: false });
    throw err;
  }
},
```

## 6. Synchronization avec server

```ts
// hooks/useSyncPlan.ts
export function useSyncPlan(planId: string) {
  const store = useTrackingPlanStore();

  // Subscribe to server changes (rare, ex: autre admin édite)
  // Pour v1 : poll toutes les 30s, ou WebSocket si infra dispo.

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!store.isDirty && !store.isSaving) {
        const server = await api.plans.getById(planId);
        if (server.bundleId !== store.serverBundleId) {
          // Server a changé — propose reload
          showConflictDialog(server, store.plan);
        }
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [planId, store]);
}
```

## 7. Selectors

```ts
// Selectors mémoïsés pour perf
export const selectEnabledProviders = (s: TrackingPlanStoreState) =>
  s.plan ? Object.entries(s.plan.providers).filter(([, p]) => p.enabled).map(([k]) => k) : [];

export const selectActiveEvents = (s: TrackingPlanStoreState) =>
  s.plan ? Object.entries(s.plan.events).filter(([, e]) => e.enabled) : [];

export const selectValidationIssuesByPath = (s: TrackingPlanStoreState, path: string) =>
  s.validationResult?.errors.filter(e => e.path?.startsWith(path)) ?? [];
```

## 8. Erreurs UX

| Cas | UX |
|---|---|
| `load` échoue (404) | Empty state "Plan introuvable" + bouton "Retour à la liste" |
| `save` échoue (network) | Toast erreur + retry auto après 10s + bouton manual retry |
| `validateNow` échoue (server down) | Validation côté client uniquement, badge "Validation locale" |
| `activate` validation échouée | Modal listant les erreurs, bouton "Aller à la section concernée" |
| Conflit (autre admin) | Modal "Cette version a été modifiée par {user}. Recharger ?" + boutons keep local / accept remote |
