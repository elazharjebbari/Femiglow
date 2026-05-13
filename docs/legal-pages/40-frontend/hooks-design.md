# 40.6 — Hooks personnalisés : design

## Convention

- Tous les hooks préfixés `useLegal…`
- Tous utilisent **SWR** pour la déduplication + cache
- Tous typés strict avec `LegalPage`, `LegalPlacement`, etc.

## Liste

### `useLegalPagesList(filter?)`

```typescript
function useLegalPagesList(filter?: { status?: LegalStatus; q?: string }) {
  const key = `/api/admin/legal?${qs(filter)}`;
  return useSWR<AdminLegalPage[]>(key, fetcher, {
    revalidateOnFocus: true,
  });
}
```

Use : page admin liste.

### `useLegalPage(slug)`

```typescript
function useLegalPage(slug: string) {
  return useSWR<AdminLegalPage>(`/api/admin/legal/${slug}`, fetcher);
}
```

Use : éditeur admin.

### `useLegalPageHistory(slug)`

```typescript
function useLegalPageHistory(slug: string) {
  return useSWR<HistoryEntry[]>(`/api/admin/legal/${slug}/history`, fetcher);
}
```

Use : drawer historique.

### `useLegalTemplateVars()`

```typescript
function useLegalTemplateVars() {
  return useSWR<TemplateVar[]>('/api/admin/legal/template-vars', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300_000,  // 5min — cache long
  });
}
```

Use : variables {{COMPANY_RC}}, {{ICE}}, ...

### `useLegalZones()`

```typescript
function useLegalZones() {
  return useSWR<Zone[]>('/api/admin/legal/zones', fetcher, {
    dedupingInterval: 600_000,  // 10min
  });
}
```

### `useLegalPlacements()`

```typescript
function useLegalPlacements() {
  return useSWR<Placement[]>('/api/admin/legal/placements', fetcher);
}
```

Use : page matrice + footer (public).

### `useLegalHealth()`

```typescript
function useLegalHealth() {
  return useSWR<HealthSnapshot>('/api/admin/legal/health', fetcher, {
    refreshInterval: 30_000,
  });
}
```

Use : dashboard health.

### `useLegalEditorAutoSave(slug, body, opts?)`

```typescript
function useLegalEditorAutoSave(
  slug: string,
  body: string,
  opts: { intervalMs?: number } = {},
) {
  const { mutate } = useLegalPage(slug);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const interval = opts.intervalMs ?? 30_000;

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await fetch(`/api/admin/legal/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body_md: body, autosave: true }),
      });
      setLastSavedAt(new Date());
      mutate();
    } catch (err) {
      setError(err as Error);
    } finally {
      setSaving(false);
    }
  }, [slug, body, mutate]);

  useEffect(() => {
    if (!body) return;
    const t = setTimeout(save, interval);
    return () => clearTimeout(t);
  }, [body, interval, save]);

  // Save on tab close / route change
  useBeforeUnload(saving, 'Modifications non sauvegardées. Quitter ?');

  return { lastSavedAt, saving, error, saveNow: save };
}
```

### `useLegalRenderer()`

```typescript
function useLegalRenderer() {
  const { data: vars } = useLegalTemplateVars();
  const varsMap = useMemo(
    () => Object.fromEntries((vars ?? []).map(v => [v.key, v.value])),
    [vars],
  );

  const render = useCallback(
    (md: string, opts: { highlightMissing?: boolean } = {}) => {
      return renderLegalMarkdownClient(md, varsMap, opts);
    },
    [varsMap],
  );

  return { render, vars: varsMap };
}
```

Use : `<MdPreview />` component.

### `useLegalPagesByZone(zone)`

```typescript
function useLegalPagesByZone(zone: ZoneKey) {
  return useSWR<PublicPlacement[]>(`/api/legal/placements/${zone}`, fetcher, {
    dedupingInterval: 600_000,
  });
}
```

Use : `<FooterLegalLinks zone="footer-main" />`.

⚠ Côté public : pas de useSWR. Préférer Server Component avec `getPlacementsByZone()` direct.
Réserver SWR aux composants client-only (CookieBanner par ex).

### `useLegalEditorLock(slug)`

```typescript
function useLegalEditorLock(slug: string) {
  const [lockOwner, setLockOwner] = useState<{ name: string; since: Date } | null>(null);

  useEffect(() => {
    const acquire = async () => {
      const res = await fetch(`/api/admin/legal/${slug}/lock`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json();
        setLockOwner({ name: body.owner.name, since: new Date(body.acquired_at) });
      }
    };
    const release = async () => {
      await fetch(`/api/admin/legal/${slug}/lock`, { method: 'DELETE' });
    };

    acquire();
    return () => { release(); };
  }, [slug]);

  return { lockOwner };  // null si lock acquis par nous
}
```

Use : warning "Édité par X depuis 5min".

V1 : pessimistic lock 15min auto-release.
V2 : optimistic via ETag.

### `useConfirmDiscard(dirty)`

```typescript
function useConfirmDiscard(dirty: boolean) {
  useBeforeUnload(dirty, 'Modifications non sauvegardées. Vraiment quitter ?');

  // Pour la nav interne :
  const router = useRouter();
  useEffect(() => {
    const handler = (e: PopStateEvent) => {
      if (dirty && !confirm('Quitter sans sauvegarder ?')) {
        e.preventDefault();
        router.forward();
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [dirty, router]);
}
```

## Tests

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('/api/admin/legal/cgv', () => HttpResponse.json({ slug: 'cgv', ... })),
);

test('useLegalPage retourne la page', async () => {
  const { result } = renderHook(() => useLegalPage('cgv'));
  await waitFor(() => expect(result.current.data?.slug).toBe('cgv'));
});

test('useLegalEditorAutoSave save après interval', async () => {
  const { result } = renderHook(() =>
    useLegalEditorAutoSave('cgv', 'new body', { intervalMs: 100 }),
  );
  await waitFor(() => expect(result.current.lastSavedAt).toBeTruthy(), {
    timeout: 200,
  });
});
```
