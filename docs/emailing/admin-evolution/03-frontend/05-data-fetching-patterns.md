# Data fetching patterns

## RSC d'abord, client-side ensuite

Toute page admin emails est un RSC. Le RSC fait :
- `requireAdmin()`
- Fetch initial des données (server actions ou queries Drizzle directes)
- Passe les données aux composants client

Les composants client (`'use client'`) :
- Re-fetchent côté client pour la fraîcheur (5s pour KPI, 30s pour list)
- Mutations via React Query

## Pattern : page list

```tsx
// app/admin/emails/audiences/page.tsx — RSC
export default async function AudiencesPage() {
  const session = await requireAdmin('/admin/emails/audiences');
  const initialAudiences = await getAudiences({ limit: 50 });
  
  return (
    <AdminShell adminEmail={session.email} active="emails">
      <AudiencesList initialData={initialAudiences} />
    </AdminShell>
  );
}
```

```tsx
// components/.../AudiencesList.tsx — client
'use client';
export function AudiencesList({ initialData }) {
  const { data, isLoading } = useQuery({
    queryKey: ['audiences', 'list'],
    queryFn: fetchAudiences,
    initialData,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
  // ...
}
```

## Pattern : preview live (debounced)

```tsx
function useAudiencePreview(rules: RulesGroup, exclusions) {
  const [debouncedRules] = useDebounce(rules, 800);
  
  return useQuery({
    queryKey: ['audiences', 'preview-size', hashRules(debouncedRules)],
    queryFn: () => previewAudienceSize(debouncedRules, exclusions),
    enabled: isRulesValid(debouncedRules),
    staleTime: 60_000,    // backend cache aussi 60s
  });
}
```

## Pattern : polling job status

```tsx
function useSnapshotJob(snapshotId: string | null) {
  return useQuery({
    queryKey: ['snapshots', snapshotId, 'status'],
    queryFn: () => getSnapshotStatus(snapshotId!),
    enabled: !!snapshotId,
    refetchInterval: (data) =>
      data?.status === 'running' ? 2000 : false,
  });
}
```

## Pattern : streaming export (CSV)

```tsx
async function exportCsv(filters) {
  const response = await fetch('/api/admin/emails/transactional/export', {
    method: 'POST',
    body: JSON.stringify({ filters }),
  });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `emails-${Date.now()}.csv`;
  a.click();
}
```

## Pattern : optimistic toggle

Voir [00-overview.md §Optimistic updates](00-overview.md).

## Caching strategy

| Resource | Cache TTL côté React Query | Cache TTL côté serveur (Redis) |
|---|---|---|
| Audience preview size | 60s | 60s |
| Outbox list | 5s (refetch on focus) | – |
| KPI summary | 5s | 30s |
| Events catalog | session | 5min |
| Saved views | sessionStorage | – |

## Error handling

```tsx
function MyComponent() {
  const query = useQuery({ ... });
  
  if (query.isError) {
    return <ErrorState 
      error={query.error}
      onRetry={() => query.refetch()}
    />;
  }
  if (query.isLoading) return <Skeleton />;
  return <Content data={query.data} />;
}
```

Erreurs réseau → toast "Connexion perdue, retry…" + auto-retry React Query.
Erreurs 4xx → message inline.
Erreurs 5xx → toast + lien support.

## SSR/SSE/WebSocket ?

- **SSR** : oui pour le initial render
- **SSE** : pas en V1 ; polling 5s suffit pour KPI
- **WebSocket** : pas en V1
