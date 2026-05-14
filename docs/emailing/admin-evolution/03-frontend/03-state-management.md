# State management

## Principe directeur

**Préférer le serveur** comme source de vérité, **URL** pour le state UI
qui doit survivre au reload (filtres, view active), **React Query**
pour le cache + mutations, **useReducer/useState** pour les wizards
multi-step.

## Stratégie par type de state

| Type | Outil | Exemple |
|---|---|---|
| Données fetchées | React Query | List outbox, list audiences |
| Mutations | React Query `useMutation` | Save view, snapshot audience |
| URL state | `useSearchParams` | view active, filtres explicites |
| Form state (multi-step) | `useReducer` | Audience wizard, automation wizard |
| Local UI state | `useState` | Modal open/closed, dropdown ouvert |
| Persistent across reload (non-shared) | `sessionStorage` | Brouillon de filtre en cours d'édition |
| Cross-component sans server | Zustand léger (optional, V2) | Selected IDs cross-component |

## Wizards : useReducer pattern

```typescript
type State = {
  step: number;
  data: {
    name?: string;
    slug?: string;
    rules?: RulesGroup;
    // ...
  };
  errors: Record<string, string>;
};

type Action =
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'UPDATE_FIELD'; field: keyof State['data']; value: unknown }
  | { type: 'SET_ERRORS'; errors: Record<string, string> }
  | { type: 'RESET' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'NEXT_STEP': return { ...state, step: state.step + 1 };
    case 'PREV_STEP': return { ...state, step: state.step - 1 };
    case 'UPDATE_FIELD': return {
      ...state,
      data: { ...state.data, [action.field]: action.value },
    };
    case 'SET_ERRORS': return { ...state, errors: action.errors };
    case 'RESET': return initialState;
  }
}
```

Persisté en `sessionStorage` (clé `wizard-draft-{wizardId}`) pour
recover si l'admin recharge.

## React Query — keys conventions

```
['outbox', 'search', filters, pagination]
['outbox', 'summary', window]
['audiences', 'list', filters]
['audiences', 'detail', id]
['audiences', 'preview-size', rulesHash]
['audiences', 'preview-sample', rulesHash]
['automation', 'list', filter]
['automation', 'detail', id]
['automation', 'runs', filter]
```

Invalidation sur mutations :
- Save view → invalidate `['views', scope]`
- Create audience → invalidate `['audiences', 'list']`
- Snapshot → invalidate `['audiences', 'detail', id]`
- Bulk retry → invalidate `['outbox', 'search']`, `['outbox', 'summary']`

## URL state — utility

```typescript
// hooks/useUrlState.ts
export function useUrlState<T>(
  key: string,
  defaultValue: T,
  serialize: (v: T) => string,
  deserialize: (s: string) => T,
): [T, (v: T) => void] {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const value = useMemo(() => {
    const raw = searchParams.get(key);
    return raw ? deserialize(raw) : defaultValue;
  }, [searchParams, key]);
  
  const setValue = useCallback((newValue: T) => {
    const params = new URLSearchParams(searchParams);
    params.set(key, serialize(newValue));
    router.replace(`?${params.toString()}`);
  }, [router, searchParams, key]);
  
  return [value, setValue];
}
```

Usage :
```typescript
const [filters, setFilters] = useUrlState(
  'filters',
  defaultFilters,
  (f) => encodeFilters(f),
  (s) => decodeFilters(s),
);
```

## Optimistic updates

Voir [00-overview.md](00-overview.md) pour le pattern.

## Server actions vs API routes

- **Server actions** : mutations admin (preview audience, save view…)
- **API routes** : endpoints qui doivent être appelés depuis cron OU
  d'autres systèmes (Listmonk webhook, Stalwart webhook, /api/cron/*)

## Pas de Redux

V1 n'a pas besoin de Redux/Zustand global. Si V2 ajoute du state
cross-section (ex sélection persistante de plusieurs items dans
plusieurs vues), considérer Zustand minimal.
