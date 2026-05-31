# 40.6 — Hooks design

## Hooks SWR (data fetching)

### `useGtmVersionsList()`
```typescript
function useGtmVersionsList() {
  const { data, error, mutate } = useSWR<{
    activeId: string | null;
    versions: GtmConfigVersion[];
  }>('/api/admin/tracking/gtm', fetcher);

  return {
    activeId: data?.activeId ?? null,
    versions: data?.versions ?? [],
    activeVersion: data?.versions.find((v) => v.id === data.activeId) ?? null,
    isLoading: !data && !error,
    error,
    refresh: mutate,
  };
}
```

### `useGtmVersion(versionId | null)`
```typescript
function useGtmVersion(versionId: string | null) {
  const { data, error } = useSWR<GtmConfigVersion>(
    versionId ? `/api/admin/tracking/gtm/${versionId}` : null,
    fetcher,
  );
  return { version: data, isLoading: versionId && !data && !error, error };
}
```

### `useProvidersSnapshot()`
```typescript
function useProvidersSnapshot() {
  const { data, error, mutate } = useSWR<ProvidersSnapshot>(
    '/api/admin/tracking/providers/snapshot',
    fetcher,
    { dedupingInterval: 60_000 }, // cache 60s
  );
  return { snapshot: data, isLoading: !data && !error, error, refresh: mutate };
}
```

### `useEventCategorization()`
```typescript
function useEventCategorization() {
  const { data, mutate } = useSWR<EventCategoryRow[]>(
    '/api/admin/tracking/events/categorization',
    fetcher,
  );

  const updateOverride = useCallback(
    async (eventName: string, googleAdsCategory: GoogleAdsCategory | null) => {
      // Optimistic
      mutate(
        (current) => current?.map((row) =>
          row.name === eventName
            ? { ...row, googleAdsCategoryOverride: googleAdsCategory, overrideUpdatedAt: new Date().toISOString() }
            : row,
        ),
        { revalidate: false },
      );

      const res = await fetch('/api/admin/tracking/events/categorization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName, googleAdsCategory }),
      });

      if (!res.ok) {
        await mutate(); // rollback
        throw new Error('Update failed');
      }
      return mutate();
    },
    [mutate],
  );

  return { rows: data ?? [], updateOverride, isLoading: !data };
}
```

### `useProvidersAnalytics(window)`
```typescript
function useProvidersAnalytics(window: '24h' | '7d' | '30d' = '7d') {
  const { data, error } = useSWR(
    `/api/admin/tracking/analytics/providers?window=${window}`,
    fetcher,
    {
      refreshInterval: 30_000, // refresh 30s
      revalidateOnFocus: false, // pas de refetch onFocus
    },
  );
  return { providers: data ?? [], isLoading: !data && !error };
}
```

## Hooks domain (composition)

### `useGtmCreateWizard(initialSeed)`
```typescript
function useGtmCreateWizard(initialSeed?: 'providers' | 'version' | 'template') {
  const [state, dispatch] = useReducer(wizardReducer, undefined, () =>
    initialWizardState(initialSeed),
  );
  const { snapshot } = useProvidersSnapshot();

  // Auto-hydrate quand snapshot est dispo
  useEffect(() => {
    if (initialSeed === 'providers' && snapshot && !state.seeded) {
      dispatch({ type: 'SEED', from: 'providers', data: snapshotToPerEnv(snapshot) });
    }
  }, [snapshot, initialSeed, state.seeded]);

  // Persist en sessionStorage
  useWizardPersistence('femiglow.wizard.gtm-create', state, dispatch);

  return { state, dispatch };
}
```

### `useTrackingClient()`
```typescript
function useTrackingClient() {
  const context = useContext(TrackingContext);
  if (!context) throw new Error('useTrackingClient must be inside TrackingProvider');

  const emit = useCallback(
    (eventName: string, params: Record<string, unknown> = {}) => {
      const eventId = crypto.randomUUID();
      context.client.emit({
        event_id: eventId,
        name: eventName,
        received_at: new Date().toISOString(),
        params,
        page: context.page(),
        user: context.user(),
        consent: context.consent(),
      });
      return eventId;
    },
    [context],
  );

  return { emit, consent: context.consent() };
}
```

### `useFormStartTracking(formId)`
```typescript
function useFormStartTracking(formId: string, formName: string) {
  const { emit } = useTrackingClient();
  const fired = useRef(false);

  const onFieldFocus = useCallback(
    (fieldName: string) => {
      if (fired.current) return;
      // Throttle 500ms : éviter double-fire au tab rapide
      const sessionKey = `femiglow.form_start.${formId}`;
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, String(Date.now()));
      fired.current = true;
      emit('form_start', {
        form_id: formId,
        form_name: formName,
        first_field: fieldName,
      });
    },
    [emit, formId, formName],
  );

  return { onFieldFocus };
}
```

Usage dans `WizardShell.tsx` :
```typescript
const { onFieldFocus } = useFormStartTracking('wizard_kit', 'Wizard Kit');
// puis sur chaque input :
<input onFocus={() => onFieldFocus('firstName')} ... />
```

## Hooks UX

### `useWizardPersistence(key, state, dispatch)`
```typescript
function useWizardPersistence<S, A>(
  key: string,
  state: S,
  dispatch: React.Dispatch<A>,
) {
  // Hydrate on mount
  useEffect(() => {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      try {
        dispatch({ type: 'HYDRATE', data: JSON.parse(raw) } as A);
      } catch { /* ignore */ }
    }
  }, [key]);

  // Persist on change
  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  // Clear on unmount (if completed)
  return useCallback(() => sessionStorage.removeItem(key), [key]);
}
```

### `useFieldSyncIndicator(currentValue, providerValue, originalValue)`
```typescript
function useFieldSyncIndicator(
  currentValue: string,
  providerValue: string | null,
  originalValue: string | null,
): SyncStatus {
  if (currentValue === providerValue) return 'in_sync';
  if (currentValue === originalValue) return 'original';
  return 'override';
}

// Composant
function SyncIndicator({ status }: { status: SyncStatus }) {
  if (status === 'in_sync') return <span title="Synchronisé avec Providers">✅</span>;
  if (status === 'override') return <span title="Modifié manuellement">⚠</span>;
  return <span title="Valeur originale" className="text-stone-400">·</span>;
}
```
