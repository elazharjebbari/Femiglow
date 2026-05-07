# Error boundaries

## Hiérarchie

```
app/
├── error.tsx                  ← root, fallback ultime
├── not-found.tsx              ← global 404
└── (admin)/
    ├── error.tsx              ← admin-specific
    └── not-found.tsx          ← admin-specific
```

## (admin)/error.tsx

```tsx
'use client';
import { Button } from '@/components/ui/Button';
import { useEffect } from 'react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry capture automatique via instrumentation, mais on log
    // explicitement le digest pour corrélation
    console.error('Admin error:', error.digest, error.message);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-creme">
      <div className="max-w-md text-center space-y-6">
        <h1 className="font-display text-3xl text-encre">
          Une erreur est survenue.
        </h1>
        <p className="text-encre/70">
          Cet incident a été enregistré. Vous pouvez réessayer ou
          revenir au tableau de bord.
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-encre/50">
            Référence : {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <Button onClick={reset}>Réessayer</Button>
          <Button variant="secondary" href="/admin/dashboard">
            Retour au tableau de bord
          </Button>
        </div>
      </div>
    </main>
  );
}
```

## (admin)/not-found.tsx

```tsx
import { Button } from '@/components/ui/Button';

export default function AdminNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-creme">
      <div className="max-w-md text-center space-y-6">
        <p className="font-script text-5xl text-encre/30">404</p>
        <h1 className="font-display text-3xl text-encre">
          Cette page n'existe pas.
        </h1>
        <Button href="/admin/dashboard">Retour au tableau de bord</Button>
      </div>
    </main>
  );
}
```

## Comportement de error.tsx

- Reçoit `error` (typé `Error & { digest?: string }`).
- Reçoit `reset` — callback qui re-rend le segment.
- Doit être un Client Component (`'use client'`).
- Ne doit **jamais** révéler le stacktrace en prod (détection via
  `process.env.NODE_ENV`).

## Comportement de not-found.tsx

- Server Component (par défaut).
- Servi quand :
  - URL ne match aucune route.
  - Une page appelle `notFound()` explicitement.

## Erreurs métier dans une page

```tsx
// /admin/leads/[id]/page.tsx
import { notFound } from 'next/navigation';

export default async function LeadDetailPage({ params }: Props) {
  const lead = await getLead(params.id);
  if (!lead) notFound(); // → rend (admin)/not-found.tsx
  if (lead.deleted_at) notFound(); // soft-deleted = considéré inexistant
  return <LeadDetail lead={lead} />;
}
```

## Erreurs API

Pas d'error boundary côté API. Chaque route handler gère son erreur
explicitement et retourne un statut HTTP approprié + body JSON
structuré :

```json
{
  "error": "validation_failed",
  "issues": [
    { "path": ["status"], "message": "Statut invalide." }
  ]
}
```

| Code interne | HTTP | Description |
|---|---|---|
| `unauthorized` | 401 | Pas de session valide |
| `forbidden` | 403 | Session valide mais action refusée |
| `not_found` | 404 | Ressource inexistante |
| `validation_failed` | 400 | Body invalide |
| `rate_limited` | 429 | Trop de requêtes |
| `conflict` | 409 | Doublon, état incompatible |
| `persistence_unavailable` | 503 | DB inaccessible |
| `internal_error` | 500 | Erreur inconnue (rare) |

## Tests des error boundaries

```ts
// Vitest + RTL
it('renders error UI on render failure', () => {
  const Throw = () => { throw new Error('boom'); };
  // Wrap with error boundary
});
```

```ts
// E2E Playwright
test('shows 404 for unknown lead', async ({ page }) => {
  await login(page);
  await page.goto('/admin/leads/nonexistent-id');
  await expect(page.getByText('Cette page n\'existe pas.')).toBeVisible();
});
```
