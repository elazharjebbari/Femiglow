# State management

## Heuristique : où vit chaque type d'état ?

| Type d'état | Où | Pourquoi |
|---|---|---|
| Données serveur (leads, webhooks) | DB via Drizzle, lues dans Server Components | Pas de double-source, pas de cache à synchroniser |
| Filtres, tri, pagination | URL search params | Bookmarkable, partageable, persistant au refresh |
| Saisie de formulaire en cours | `react-hook-form` (mémoire composant) | UX classique, validation Zod, pas besoin de partager |
| Erreurs de validation | `react-hook-form` formState | idem |
| Statut submit (loading, succès) | local state (`useState`) | court-vivant, pas global |
| Toasts | provider global existant (`<ToastProvider>`) | déjà en place côté marketing |
| Session admin | cookie `fg_admin_session` | source de vérité côté serveur |
| Préférences utilisatrice (densité, etc., v1.1+) | `localStorage` + Zustand persist | survit au refresh, pas critique |
| KPIs dashboard | refetch via `revalidatePath` après mutation | fraîcheur garantie sans live polling |

## Ce que l'on **ne fait pas**

- Pas de Redux, Recoil, Jotai.
- Pas de SWR ou React Query : Server Components couvrent les reads, et
  les mutations sont gérées par `router.refresh()` après `fetch`.
- Pas de Zustand global pour l'admin v1 (réservé v1.1 pour les prefs).

## Patterns de mutation

### Pattern 1 — Mutation déclenchée depuis Client Component

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';

export function LeadStatusSelector({ leadId, currentStatus }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isSubmitting, setSubmitting] = useState(false);

  async function changeStatus(newStatus: LeadStatus) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed');
      showToast({ kind: 'success', message: 'Statut mis à jour.' });
      router.refresh(); // re-render Server Component avec la nouvelle valeur
    } catch (e) {
      showToast({ kind: 'error', message: 'Une erreur est survenue.' });
    } finally {
      setSubmitting(false);
    }
  }
  // ...
}
```

### Pattern 2 — Suppression avec confirmation

```tsx
'use client';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  // ... handler appelle DELETE /api/admin/leads/[id] puis router.push('/admin/leads')
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>Supprimer</Button>
      <ConfirmationModal
        open={open}
        onConfirm={async () => { /* ... */ }}
        onCancel={() => setOpen(false)}
        title="Supprimer ce lead ?"
        description="Cette action est irréversible."
        confirmLabel="Supprimer définitivement"
        variant="danger"
      />
    </>
  );
}
```

### Pattern 3 — Filtres URL

```tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export function LeadFilters({ initial }: { initial: SearchParams }) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setFilter(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    next.delete('cursor'); // reset pagination
    startTransition(() => {
      router.push(`?${next.toString()}`);
    });
  }
  // ...
}
```

`useTransition` empêche un loader bloquant pendant que la page se
re-rend.

## Cycle de fraîcheur

```
1. User déclenche une mutation (ex. changer statut)
2. Client Component → fetch POST /api/admin/...
3. Route handler → Drizzle UPDATE → INSERT lead_event
4. Réponse 200 → showToast succès
5. router.refresh() → Server Component se re-rend, lit la DB
6. UI à jour, pas de double-source
```

## Tests state

| Type d'état | Test |
|---|---|
| Filtre URL | E2E (Playwright) : naviguer + assert URL + assert résultats |
| Form submit | Unit (Vitest + RTL) : remplir + soumettre + assert mock fetch |
| Refresh après mutation | E2E + MSW |
| Toast affiché | Unit RTL : query par texte |
