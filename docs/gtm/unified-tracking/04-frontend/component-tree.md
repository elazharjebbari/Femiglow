# Arborescence des composants admin

## 1. Vue d'ensemble

```
app/admin/tracking/
├── page.tsx                                # /admin/tracking — Home
├── plans/
│   ├── page.tsx                            # /admin/tracking/plans — liste
│   ├── new/
│   │   └── page.tsx                        # /admin/tracking/plans/new
│   └── [id]/
│       ├── page.tsx                        # /admin/tracking/plans/[id] — détail
│       ├── edit/
│       │   └── page.tsx                    # /admin/tracking/plans/[id]/edit
│       └── preview/
│           └── page.tsx                    # /admin/tracking/plans/[id]/preview
├── sync/
│   └── page.tsx                            # /admin/tracking/sync — drift dashboard
└── (legacy redirects)/                     # redirections /pixels, /events/mappings, /gtm

src/components/admin/tracking/plan/
├── TrackingPlanHome.tsx                    # Carte status + boutons home
├── TrackingPlanList.tsx                    # Liste versions
├── TrackingPlanWizard.tsx                  # Wizard 5 étapes
├── TrackingPlanExpert.tsx                  # Éditeur 3 colonnes
├── store.ts                                # Zustand store
├── sections/
│   ├── ProvidersSection.tsx                # Step 2 wizard ou panneau expert
│   ├── EventsMatrix.tsx                    # Step 3 — matrice événements
│   ├── EnvProfilesSection.tsx              # Step 4 — env profiles
│   ├── ProviderCard.tsx                    # 1 card par provider
│   ├── EventRow.tsx                        # 1 ligne par event dans la matrice
│   └── EnvProfileForm.tsx                  # 1 form par env
├── preview/
│   ├── JsonPreview.tsx                     # Preview JSON avec syntax highlight
│   ├── DiffViewer.tsx                      # Diff entre 2 versions
│   └── ContainerStats.tsx                  # Métriques (nb tags, nb triggers)
├── wizard/
│   ├── WizardShell.tsx                     # Wrapper stepper + nav
│   ├── Step1ChooseTools.tsx                # Outils à activer
│   ├── Step2Identifiers.tsx                # IDs (pré-remplis)
│   ├── Step3Events.tsx                     # Matrice événements simplifiée
│   ├── Step4Envs.tsx                       # Env profiles
│   └── Step5Review.tsx                     # Vérification + publish
├── controls/
│   ├── IdInput.tsx                         # Input avec validation regex + badge auto-rempli
│   ├── ProviderToggle.tsx                  # Switch on/off
│   ├── ConsentBadge.tsx                    # Affichage requirement consent
│   └── PlaceholderWarning.tsx              # Warning si valeur ressemble placeholder
└── shared/
    ├── ValidationBadge.tsx                 # ✓ / ⚠ / ✗ inline
    ├── StatusBadge.tsx                     # draft / active / archived
    ├── BundleIdChip.tsx                    # Affiche bundleId court + tooltip full
    └── HelpTooltip.tsx                     # ? avec popover explicatif
```

## 2. Détail composants clés

### TrackingPlanHome

**Route :** `/admin/tracking`

```tsx
interface TrackingPlanHomeProps {}

// Lit via TanStack Query :
//   - useActivePlan() → plan actif
//   - useSyncStatus() → drift state
//   - useRecentPlans() → 5 derniers

// Affiche :
//   - <StatusCard plan={activePlan} sync={syncStatus} />
//   - <ActionButtons /> (Modifier, Nouveau, Historique)
//   - <RecentPlansList plans={recent} />
```

### TrackingPlanWizard

**Route :** `/admin/tracking/plans/[id]/edit?mode=wizard` (défaut)

```tsx
interface TrackingPlanWizardProps {
  planId: string;
  initialStep?: 1 | 2 | 3 | 4 | 5;
}

// Lit via useTrackingPlanStore() :
//   - plan (draft local)
//   - currentStep
//   - validationErrors
//   - isDirty
//   - actions: setStep, updateField, save, activate

// Structure :
//   <WizardShell currentStep={currentStep} onStepChange={setStep}>
//     {currentStep === 1 && <Step1ChooseTools />}
//     {currentStep === 2 && <Step2Identifiers />}
//     {currentStep === 3 && <Step3Events />}
//     {currentStep === 4 && <Step4Envs />}
//     {currentStep === 5 && <Step5Review />}
//   </WizardShell>
```

### TrackingPlanExpert

**Route :** `/admin/tracking/plans/[id]/edit?mode=expert`

```tsx
interface TrackingPlanExpertProps {
  planId: string;
}

// Layout 3 colonnes (desktop) :
//   <ExpertShell>
//     <Sidebar>
//       <SectionLink id="providers" label="Outils" />
//       <SectionLink id="identifiers" label="Identifiants" />
//       <SectionLink id="events" label="Événements (18)" />
//       <SectionLink id="envs" label="Environnements" />
//       <SectionLink id="validation" label="Validation (2⚠)" />
//     </Sidebar>
//     <Editor activeSection={activeSection} />
//     <PreviewPanel json={exportedJson} />
//   </ExpertShell>
//
// Mobile : affiche message "Mode expert non disponible sur mobile" + bouton "Passer au wizard"
```

### EventsMatrix

```tsx
interface EventsMatrixProps {
  events: Record<string, EventConfig>;
  providers: ProvidersConfig;
  onChange: (eventName: string, patch: Partial<EventConfig>) => void;
  filter?: string; // recherche par nom
}

// Affichage :
//   Table virtualisée (react-virtual ou TanStack Virtual)
//   Header : Nom | GA4 | Ads | Meta | TikTok | Consent
//   Row par event :
//     <EventNameCell name="lead_form_submit" />
//     <EventMappingCell provider="ga4" mapping={event.mappings.ga4} />
//     ...
//   Click sur cell → ouvre popover édition (mappedName, isCustom, ...)
```

### IdInput

```tsx
interface IdInputProps {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  validate: (value: string) => string | null; // returns error message or null
  autocomplete?: string; // valeur proposée (ex: depuis defaults)
  placeholder?: string;
  required?: boolean;
}

// Affiche :
//   <label>{label}</label>
//   <input value={value ?? ''} onChange={onChange} />
//   {value === autocomplete && <Badge>auto-rempli</Badge>}
//   {value !== autocomplete && autocomplete && <RevertButton />}
//   {validateError && <ErrorMessage>{validateError}</ErrorMessage>}
//   {isPlaceholder(value) && <PlaceholderWarning value={value} />}
```

## 3. Patterns transversaux

### 3.1 Fetch via TanStack Query

```ts
// hooks/useActivePlan.ts
export function useActivePlan() {
  return useQuery({
    queryKey: ['plan', 'active'],
    queryFn: () => api.plans.getActive(),
    staleTime: 30_000,
  });
}

// hooks/usePlanMutation.ts
export function usePlanMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: DeepPartial<TrackingPlan>) => api.plans.update(id, patch),
    onSuccess: (data) => {
      queryClient.setQueryData(['plan', id], data);
      queryClient.invalidateQueries({ queryKey: ['plan', 'active'] });
    },
  });
}
```

### 3.2 Auto-save debounce

```ts
// store.ts (extrait)
const useTrackingPlanStore = create(persist((set, get) => ({
  // ...
  updateField: (path, value) => {
    set(produce(state => { set_at_path(state.plan, path, value); }));
    get().scheduleAutoSave();
  },
  scheduleAutoSave: debounce(() => {
    if (get().isDirty) get().save();
  }, 5000),
}));
```

### 3.3 Validation côté client (instantanée)

Réutilise le même `TrackingPlanSchema` Zod côté client. Aucune dette API : le validator client est strict identique au validator serveur. Erreurs affichées sous les champs en temps réel.

## 4. Internationalisation

Aujourd'hui FemiGlow a déjà `lib/checkout/i18n/locales/{fr,ar}.ts`. On crée un namespace `tracking-admin` similaire :

```
src/lib/admin/tracking/i18n/
├── locales/
│   ├── fr.ts
│   └── ar.ts (RTL)
└── dictionary.ts
```

L'admin marketing étant principalement francophone, FR est prioritaire. AR ajouté pour parité.

## 5. Accessibility

- Tous les champs ont un label visible.
- Stepper wizard : `aria-current="step"` sur l'étape active.
- Validation errors : `aria-live="polite"` sous chaque champ.
- Boutons d'action : `aria-disabled` si pré-conditions non remplies.
- Modale de confirmation activation : focus trap, ESC ferme, Enter confirme.
- Diff viewer : touche navigation clavier entre les lignes modifiées.
