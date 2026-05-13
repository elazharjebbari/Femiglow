# 40.2 — State management

## Stratégie globale

**Pas de Redux/Zustand**. La complexité ne le justifie pas. On utilise :
- `useState` + `useReducer` pour le state local complexe (wizard, matrice en édition)
- `useSWR` (ou équivalent natif Next.js) pour le cache HTTP et la revalidation
- URL state (Next.js router + searchParams) pour les filtres deep-linkables

## Hook custom : `useMappings()`

```typescript
import useSWR from 'swr';

export function useMappings(opts: { status?: Status[] } = {}) {
  const query = new URLSearchParams();
  if (opts.status) query.set('status', opts.status.join(','));
  
  const { data, error, isLoading, mutate } = useSWR(
    `/api/admin/tracking/events/mappings?${query}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );
  
  return {
    versions: data?.versions ?? [],
    activeId: data?.activeId ?? null,
    defaultId: data?.defaultId ?? '__default__',
    isLoading,
    error,
    refresh: mutate,
  };
}
```

## Hook custom : `useMappingVersion(id)`

```typescript
export function useMappingVersion(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/admin/tracking/events/mappings/${id}` : null,
    fetcher,
  );
  
  return {
    version: data ?? null,
    isLoading,
    error,
    refresh: mutate,
  };
}
```

## Hook custom : `useMappingMutations()`

```typescript
export function useMappingMutations() {
  return {
    create: useCallback(async (input) => {
      const res = await fetch('/api/admin/tracking/events/mappings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw await parseError(res);
      return res.json();
    }, []),
    
    update: useCallback(async (id, mappings) => { /* PUT */ }, []),
    activate: useCallback(async (id) => { /* POST /activate */ }, []),
    archive: useCallback(async (id) => { /* POST */ }, []),
    softDelete: useCallback(async (id) => { /* DELETE */ }, []),
    restore: useCallback(async (id) => { /* POST */ }, []),
    
    test: useCallback(async (id, eventName) => { /* POST /test */ }, []),
    exportGtm: useCallback(async (id, env) => { /* POST /export-gtm */ }, []),
    resetDefault: useCallback(async () => { /* POST /reset-default */ }, []),
  };
}
```

Toutes les mutations :
- Throw HttpError typé en cas d'échec
- Auto-revalidation SWR après succès (via `mutate(...)`)
- Toast feedback (succès/erreur) géré par `useToast()` global

## State local : éditeur de matrice

```typescript
// Dans MappingVersionEditor
const [mappings, setMappings] = useState<Mappings>(initialMappings);
const [dirty, setDirty] = useState(false);
const [editingCell, setEditingCell] = useState<{ event: string; provider: ProviderKind } | null>(null);

// Submit logic
async function handleSave() {
  if (!dirty) return;
  const newVersion = await mutations.update(versionId, mappings);
  toast.success(`Nouvelle version ${newVersion.name} créée (draft)`);
  router.push(`/admin/tracking/events/mappings/${newVersion.id}`);
}

// Discard confirm
useBeforeUnload(dirty, "Modifications non sauvegardées. Quitter sans enregistrer ?");
```

## State : wizard de création

```typescript
type WizardState =
  | { step: 1; source: 'default' | 'clone' | 'import' | null; sourceId?: string; importedMappings?: Mappings }
  | { step: 2; source: ...; name: string; notes: string }
  | { step: 3; source: ...; name: string; notes: string }
  | { step: 'submitting' }
  | { step: 'submitted'; createdId: string };

const [state, dispatch] = useReducer(wizardReducer, { step: 1, source: null });
```

## URL state — filtres deep-linkables

```typescript
// /admin/tracking/events/mappings?status=draft,archived&showDeleted=true
const router = useRouter();
const searchParams = useSearchParams();
const statusFilter = (searchParams.get('status')?.split(',') ?? ['all']) as Status[];
const showDeleted = searchParams.get('showDeleted') === 'true';

function setStatusFilter(next: Status[]) {
  const params = new URLSearchParams(searchParams);
  params.set('status', next.join(','));
  router.push(`?${params}`);
}
```

Avantage : un admin peut copier-coller son URL avec ses filtres et la partager.

## Optimistic UI

Pour les actions rapides (toggle isEnabled d'une cellule) :
```typescript
async function toggleCellEnabled(event, provider) {
  // 1. Update local state immédiatement
  setMappings(prev => /* toggle */);
  setDirty(true);
  // 2. Pas de fetch ici — le save global s'occupera de tout
}
```

Pour les mutations atomiques (activate, delete) :
```typescript
async function handleActivate(id) {
  // 1. Optimistic : marque la version comme "activating..."
  mutate((cur) => ({ ...cur, activatingId: id }), { revalidate: false });
  try {
    await mutations.activate(id);
    mutate(); // revalidate
    toast.success("Version activée");
  } catch (err) {
    mutate(); // rollback
    toast.error(err.message);
  }
}
```

## Concurrency control

Si 2 admins éditent en même temps :
- Le PUT inclut `If-Match: <updatedAt>` (header)
- Si serveur détecte conflit (updatedAt en DB différent) → 409
- UI propose : "Une autre modification existe. Recharger ou écraser ?"

V1 simple : pas de If-Match. Risque accepté (FemiGlow team < 5 admins, peu de concurrence réelle).

## Cache invalidation

- Mutation success → SWR `mutate()` revalide automatiquement
- Cache resolver côté serveur (in-memory 30s) → invalidé par `store.activate()` 
- Pas de cache HTTP côté Next.js (toutes les routes admin sont `no-store`)
