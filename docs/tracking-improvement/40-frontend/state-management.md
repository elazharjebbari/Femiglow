# 40.5 — State management

## Stratégie

- **SWR** pour data fetching (déjà utilisé dans l'admin)
- **`useReducer`** pour state de wizard complexe
- **`useState`** pour state de form simple
- **`localStorage`** uniquement pour preferences UI (pas de business state)
- **No Zustand/Redux** pour ces chantiers (overkill)

## Patterns par écran

### `GtmConfigList` (liste des versions)

```typescript
const { data, error, mutate } = useSWR('/api/admin/tracking/gtm', fetcher);
const { activeId, versions } = data ?? { activeId: null, versions: [] };

// Sur action :
async function activate(id) {
  await fetch(`/api/admin/tracking/gtm/${id}/activate`, { method: 'POST' });
  mutate(); // revalide
}
```

### `GtmCreateWizard` / `GtmEditWizard` (state machine)

```typescript
type WizardState = {
  step: WizardStepId;
  config: GtmConfigPerEnv;  // hydrate from seed
  originalVersion?: GtmConfigVersion;  // si mode=edit
  diffSummary?: DiffSummary;
};

type Action =
  | { type: 'SEED'; from: 'providers' | 'version' | 'template'; data: GtmConfigPerEnv }
  | { type: 'UPDATE_FIELD'; env: EnvKey; field: string; value: string }
  | { type: 'BROADCAST'; from: EnvKey; targets: EnvKey[] }
  | { type: 'GOTO'; step: WizardStepId }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'COMPUTE_DIFF' };

function wizardReducer(state, action) {
  switch (action.type) {
    case 'SEED':
      return { ...state, config: action.data };
    case 'UPDATE_FIELD':
      return {
        ...state,
        config: {
          ...state.config,
          [action.env]: {
            ...state.config[action.env],
            [action.field]: action.value,
          },
        },
      };
    case 'BROADCAST': {
      const source = state.config[action.from];
      const next = { ...state.config };
      for (const target of action.targets) {
        next[target] = { ...source };
      }
      return { ...state, config: next };
    }
    case 'COMPUTE_DIFF':
      return {
        ...state,
        diffSummary: computeDiff(state.originalVersion?.perEnv, state.config),
      };
    case 'NEXT':
      return { ...state, step: nextStepOf(state.step, state) };
    // ...
  }
}
```

### `EventCategorizationTable`

```typescript
const { data, mutate } = useSWR<EventCategoryRow[]>('/api/admin/tracking/events/categorization', fetcher);

async function updateOverride(eventName, googleAdsCategory) {
  // Optimistic update
  mutate(
    (current) => current?.map((row) =>
      row.name === eventName
        ? { ...row, googleAdsCategoryOverride: googleAdsCategory }
        : row,
    ),
    { revalidate: false },
  );
  // Server sync
  await fetch('/api/admin/tracking/events/categorization', {
    method: 'PUT',
    body: JSON.stringify({ eventName, googleAdsCategory }),
  });
  mutate(); // re-revalidate
}
```

### `ProvidersAnalyticsTable`

```typescript
const { data } = useSWR(
  `/api/admin/tracking/analytics/providers?window=${window}`,
  fetcher,
  { refreshInterval: 30000 }, // 30s
);
```

## Patterns anti-loup

| Anti-pattern | À éviter |
|---|---|
| `useEffect` qui set du state local depuis SWR | ❌ Utiliser SWR `select` ou directement `data` |
| Mutate sans optimistic | ⚠ OK pour MVP, mais perceptible latence |
| Re-fetch sur chaque keystroke | ❌ Debounce les inputs ou utiliser onBlur |
| Zustand global store pour 1 form | ❌ useState suffit |
| Form state perdu sur back nav | ⚠ persist en `sessionStorage` si critique |

## Persistence des wizards

Pour les wizards multi-step, persister dans `sessionStorage` :

```typescript
const STORAGE_KEY = 'femiglow.wizard.gtm-create';

useEffect(() => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}, [state]);

useEffect(() => {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (raw) dispatch({ type: 'HYDRATE', data: JSON.parse(raw) });
}, []);

// À la fin du wizard :
sessionStorage.removeItem(STORAGE_KEY);
```

Permet de fermer l'onglet et revenir sans tout perdre.
