# scenario-leads-list

| Aspect | Valeur |
|---|---|
| Domaine | leads |
| Composant | `LeadTable` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/LeadTable.integration.test.tsx` |
| Référence | F-LEADS-01 |

## Préconditions
- Utilisateur authentifié sur `/admin/leads`.
- Aucun filtre actif (URL nue).
- 25 leads existent en base, le serveur renvoie une page de 20.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';
import { makeLead } from '@/test/msw/factories/lead';

export const handlers = [
  http.get('*/api/admin/leads', ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    if (cursor) {
      return HttpResponse.json({
        items: Array.from({ length: 5 }, (_, i) => makeLead({ id: `lead_p2_${i}` })),
        nextCursor: null,
        total: 25,
      });
    }
    return HttpResponse.json({
      items: Array.from({ length: 20 }, (_, i) =>
        makeLead({ id: `lead_p1_${i}`, fullName: `Lead ${i}` }),
      ),
      nextCursor: 'cur_page2',
      total: 25,
    });
  }),
];
```

## Action utilisateur

1. Naviguer vers `/admin/leads`.
2. Attendre que la liste se charge.

## Assertions

- Pendant le chargement, un skeleton de 10 lignes est rendu (`role="status"`).
- 20 lignes de leads sont rendues après la résolution de la requête.
- L'en-tête de table est sticky (CSS, hors test) ; le `<thead>` est rendu une seule fois.
- Le compteur affiche « 25 résultats ».
- Le bouton "Suivant" est actif (`nextCursor` non null).
- Le bouton "Précédent" est désactivé (cursor initial).
- Chaque ligne expose `data-testid="lead-row"` avec l'`id`.

## Edge cases couverts ailleurs

- Pagination réelle → `scenario-leads-pagination.md`
- Filtres actifs → `scenario-leads-filters.md`
- Liste vide → `scenario-leads-empty.md`
- Recherche → `scenario-leads-search.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import { LeadTable } from './LeadTable';

it('affiche 20 lignes et le compteur total', async () => {
  render(<LeadTable />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  const rows = await screen.findAllByTestId('lead-row');
  expect(rows).toHaveLength(20);
  expect(screen.getByText(/25 résultats/i)).toBeInTheDocument();
});
```
