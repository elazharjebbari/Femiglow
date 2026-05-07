# scenario-leads-filters

| Aspect | Valeur |
|---|---|
| Domaine | leads |
| Composant | `LeadFilters` + `LeadTable` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/LeadFilters.integration.test.tsx` |
| Référence | F-LEADS-02 |

## Préconditions
- Utilisateur authentifié sur `/admin/leads`.
- Le composant lit/écrit l'URL via `useSearchParams` + `router.replace`.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';
import { makeLead } from '@/test/msw/factories/lead';

export const handlers = [
  http.get('*/api/admin/leads', ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');
    if (type === 'order' && status === 'new') {
      return HttpResponse.json({
        items: [makeLead({ id: 'lead_filtered', type: 'order', status: 'new' })],
        nextCursor: null,
        total: 1,
      });
    }
    return HttpResponse.json({
      items: Array.from({ length: 20 }, (_, i) => makeLead({ id: `lead_${i}` })),
      nextCursor: null,
      total: 20,
    });
  }),
];
```

## Action utilisateur

1. Ouvrir le `<select>` "Type" et choisir "Commande".
2. Ouvrir le menu "Statut" et cocher "Nouveau".
3. Attendre que la table se rafraîchisse.

## Assertions

- L'URL est mise à jour : `?type=order&status=new`.
- Une seule requête API est faite après les deux changements (debounce ou batch).
- La table affiche 1 ligne `lead_filtered`.
- Le bouton "Réinitialiser" devient actif et nettoie l'URL au clic.
- Les query params invalides sont ignorés sans crash (`status=foo` → ignoré).

## Edge cases couverts ailleurs

- Recherche `q` → `scenario-leads-search.md`
- Aucune correspondance → `scenario-leads-empty.md`
- Pagination conservée à travers filtres → `scenario-leads-pagination.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/leads',
}));

it('synchronise les filtres avec lURL', async () => {
  const user = userEvent.setup();
  render(<LeadFilters />);
  await user.selectOptions(screen.getByLabelText('Type'), 'order');
  await user.click(screen.getByLabelText('Nouveau'));
  await vi.waitFor(() => {
    expect(replace).toHaveBeenLastCalledWith('/admin/leads?type=order&status=new');
  });
});
```
