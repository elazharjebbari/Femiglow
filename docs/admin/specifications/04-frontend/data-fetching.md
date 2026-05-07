# Data fetching

## Reads (Server Components → DB direct)

```tsx
// apps/web/src/app/(admin)/leads/page.tsx
import { listLeads } from '@/lib/db/queries/leads';
import { LeadTable } from '@/components/admin/tables/LeadTable';

export default async function LeadsPage({ searchParams }: Props) {
  const { items, nextCursor, total } = await listLeads({
    type: searchParams.type,
    status: searchParams.status?.split(','),
    from: searchParams.from,
    to: searchParams.to,
    q: searchParams.q,
    cursor: searchParams.cursor,
    limit: 25,
  });
  return <LeadTable items={items} nextCursor={nextCursor} total={total} />;
}
```

**Avantages** :
- Une seule requête depuis le composant qui en a besoin.
- Pas de cache HTTP à invalider (pas de couche REST).
- Typage automatique du retour Drizzle.
- Authentification "gratuite" : la page est protégée par middleware,
  pas besoin de re-vérifier dans la query.

## Writes (Client Component → API admin → DB)

```tsx
'use client';
async function patchStatus(leadId: string, status: LeadStatus) {
  const res = await fetch(`/api/admin/leads/${leadId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed');
}
```

L'API admin :
1. Vérifie la session (middleware déjà passé, double-check via
   `getSession()`).
2. Valide le body (Zod).
3. UPDATE la DB.
4. INSERT un `lead_event`.
5. Renvoie 200 ou erreur appropriée.

## Quand utiliser une API REST plutôt que Server Action ?

| Cas | Choix | Raison |
|---|---|---|
| Mutation simple, déclenchée par formulaire HTML standard | Server Action | concis |
| Mutation avec besoin de réponse JSON typée | route handler | testable MSW directement |
| Mutation potentiellement appelée par un futur SDK CLI | route handler | API stable et observable |
| Mutation déclenchée par bouton dans Client Component | route handler | meilleure UX (no full page navigation) |

**Choix retenu pour FemiGlow** : route handlers pour toutes les
mutations admin. Cohérence + testabilité MSW + observabilité Sentry.

## Cache et revalidation

| Cas | Stratégie |
|---|---|
| Page admin (chaque requête) | `dynamic = 'force-dynamic'` (jamais cachée) |
| Mutation réussie | `router.refresh()` côté client → re-render Server Component |
| Mutation cross-route (ex. créer un webhook depuis lead detail) | `revalidatePath('/admin/webhooks')` côté serveur |

## Pas de SWR / React Query

Server Components remplacent ces libs pour les reads. Pour les
mutations, `fetch` natif + `router.refresh()` suffit.

## Gestion d'erreurs réseau

```tsx
async function safeFetch(url: string, opts: RequestInit) {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) });
    return res;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new Error('NETWORK_TIMEOUT');
    }
    throw new Error('NETWORK_ERROR');
  }
}
```

À utiliser uniformément depuis les hooks de mutation. Le toast affiche
"La connexion semble interrompue."

## Streaming (Suspense)

```tsx
// apps/web/src/app/(admin)/dashboard/page.tsx
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <>
      <Suspense fallback={<KPISkeleton />}>
        <KPICards />  {/* requête longue */}
      </Suspense>
      <Suspense fallback={<RecentLeadsSkeleton />}>
        <RecentLeads /> {/* requête plus rapide, mais indép. */}
      </Suspense>
    </>
  );
}
```

Bénéfice : TTFB rapide, sections apparaissent dès qu'elles sont prêtes.

## Export CSV

```ts
// apps/web/src/app/api/admin/leads/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('format') === 'csv') {
    return new Response(
      streamLeadsToCsv(filters),
      {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="leads-2026-05-03.csv"',
        },
      }
    );
  }
  // JSON par défaut
}
```

`streamLeadsToCsv` retourne un `ReadableStream` qui scanne la DB en
batch (cursor) et émet ligne par ligne. Pas de OOM même sur 100 000
leads.
