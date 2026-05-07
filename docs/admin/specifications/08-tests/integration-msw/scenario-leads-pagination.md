# scenario-leads-pagination

| Aspect | Valeur |
|---|---|
| Domaine | leads |
| Composant | `Pagination` + `LeadTable` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/Pagination.integration.test.tsx` |
| Référence | F-LEADS-03 |

## Préconditions
- Liste leads chargée page 1, `nextCursor: 'cur_p2'`.
- Composant utilise un cursor opaque, pas un offset numérique.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';
import { makeLead } from '@/test/msw/factories/lead';

export const handlers = [
  http.get('*/api/admin/leads', ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    if (cursor === 'cur_p2') {
      return HttpResponse.json({
        items: Array.from({ length: 20 }, (_, i) =>
          makeLead({ id: `p2_${i}`, fullName: `Page2 ${i}` }),
        ),
        nextCursor: 'cur_p3',
        total: 60,
      });
    }
    return HttpResponse.json({
      items: Array.from({ length: 20 }, (_, i) =>
        makeLead({ id: `p1_${i}`, fullName: `Page1 ${i}` }),
      ),
      nextCursor: 'cur_p2',
      total: 60,
    });
  }),
];
```

## Action utilisateur

1. Cliquer "Suivant" en bas de la table.
2. Attendre le rendu de la page 2.
3. Cliquer "Précédent".

## Assertions

- Au clic "Suivant", l'URL est mise à jour : `?cursor=cur_p2`.
- Une nouvelle requête est faite avec `?cursor=cur_p2`.
- La table affiche 20 leads `p2_*`.
- L'historique des cursors est maintenu (stack) pour permettre "Précédent".
- "Précédent" replace `?cursor=cur_p2` par l'URL initiale (sans `cursor`).
- Les filtres existants (`type`, `status`) sont conservés à travers la pagination.

## Edge cases couverts ailleurs

- Empty state après pagination → `scenario-leads-empty.md`
- Filtres actifs → `scenario-leads-filters.md`

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

it('navigue cursor avant/arrière', async () => {
  const user = userEvent.setup();
  render(<LeadTable />);
  await screen.findByText('Page1 0');
  await user.click(screen.getByRole('button', { name: /suivant/i }));
  expect(await screen.findByText('Page2 0')).toBeInTheDocument();
  expect(replace).toHaveBeenCalledWith('/admin/leads?cursor=cur_p2');
});
```
