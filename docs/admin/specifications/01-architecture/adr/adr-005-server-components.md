# ADR-005 — Server Components pour les pages admin

| Champ | Valeur |
|---|---|
| Statut | Accepté |
| Date | 2026-05-03 |

## Contexte

Next.js 14 App Router permet aux pages d'être des React Server
Components (RSC) qui s'exécutent côté serveur, peuvent lire la DB
directement et envoyer du HTML pré-rendu. Alternative : Client
Components qui fetch via API REST.

Pour l'admin, les pages affichent principalement des **données lues** :
liste de leads, détail d'un lead, livraisons webhook. Les **mutations**
(changement de statut, ajout note) sont rares et peuvent passer par des
route handlers.

## Décision

- **Pages admin** = Server Components par défaut.
  - Lecture directe via Drizzle (`import { db } from '@/lib/db/client'`).
  - Pas de couche API REST pour les reads admin.
  - Server Actions optionnelles pour les mutations simples.
- **Composants interactifs** = Client Components (`'use client'`).
  - Filtres, pagination cliente, formulaires `react-hook-form`.
  - Reçoivent les données initiales via props depuis le Server Component
    parent.
- **Mutations** = route handlers `/api/admin/*` (POST, PATCH, DELETE).
  - Préférés aux Server Actions pour : meilleure observabilité (Sentry,
    Network tab), testabilité MSW directe, possibilité d'utilisation
    par un futur SDK CLI.

## Conséquences

### Positives

- Pas de double-spec API REST + page (une seule source : la requête
  Drizzle dans la page).
- Authentification triviale : `await getSession()` côté serveur dans la
  page → si null, le middleware a déjà redirigé.
- Bundle JS minimal (les composants serveur n'envoient pas leur code au
  navigateur).
- TTFB excellent (HTML pré-rendu avec données réelles).
- Refresh automatique via `revalidatePath('/admin/leads')` après mutation.

### Négatives

- Filtres dynamiques avec re-render → URL search params (pas de state
  client lourd). Acceptable car URLs partageables.
- Tests : impossible de tester un Server Component avec
  `@testing-library/react` directement. Mitigation : tester la requête
  Drizzle isolément (unit) + tester le flux complet via Playwright (E2E).

## Pattern type d'une page

```tsx
// apps/web/src/app/(admin)/leads/page.tsx
import { getSession } from '@/lib/auth/session';
import { listLeads } from '@/lib/db/queries/leads';
import { LeadTable } from '@/components/admin/LeadTable';
import { LeadFilters } from '@/components/admin/LeadFilters';

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { type?: string; status?: string; q?: string; cursor?: string };
}) {
  await getSession(); // garde middleware déjà passée, mais double-check
  const { items, nextCursor } = await listLeads(searchParams);
  return (
    <>
      <LeadFilters initial={searchParams} />
      <LeadTable items={items} nextCursor={nextCursor} />
    </>
  );
}
```

## Critères d'acceptation

- [ ] Aucune page admin n'a `'use client'` au top-level.
- [ ] Aucune page admin ne fait `fetch('/api/admin/...')` côté serveur
      (lit directement la DB).
- [ ] Les mutations passent par route handlers (testables MSW).
- [ ] Le bundle JS de `/admin/leads` < 80 kB gzip.
