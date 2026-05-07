# scenario-leads-search

| Aspect | Valeur |
|---|---|
| Domaine | leads |
| Composant | `LeadFilters` (champ recherche) |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/LeadFilters.integration.test.tsx` |
| Référence | F-LEADS-04 |

## Préconditions
- L'utilisateur tape dans le champ "Rechercher" du composant `LeadFilters`.
- Debounce de 300 ms appliqué côté client.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';
import { makeLead } from '@/test/msw/factories/lead';

export const handlers = [
  http.get('*/api/admin/leads', ({ request }) => {
    const q = new URL(request.url).searchParams.get('q') ?? '';
    if (q === 'leila') {
      return HttpResponse.json({
        items: [makeLead({ id: 'lead_leila', fullName: 'Leïla Bennani' })],
        nextCursor: null,
        total: 1,
      });
    }
    return HttpResponse.json({ items: [], nextCursor: null, total: 0 });
  }),
];
```

## Action utilisateur

1. Cliquer le champ "Rechercher".
2. Taper `l`, `e`, `i`, `l`, `a` (5 frappes).
3. Attendre 300 ms après la dernière frappe.

## Assertions

- Une **seule** requête API est faite (debounce respecté), pas une par frappe.
- L'URL est mise à jour avec `?q=leila`.
- La table affiche `Leïla Bennani`.
- Le champ conserve sa valeur après le rendu de la table.
- Effacer le champ (`Backspace x5`) déclenche une seule requête sans `q`.
- Une frappe pendant la requête en vol annule l'ancienne (AbortController).

## Edge cases couverts ailleurs

- Empty state → `scenario-leads-empty.md`
- Filtres combinés → `scenario-leads-filters.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { LeadFilters } from './LeadFilters';

it('debounce la recherche à 300 ms', async () => {
  vi.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const fetchSpy = vi.spyOn(global, 'fetch');
  render(<LeadFilters />);
  await user.type(screen.getByLabelText('Rechercher'), 'leila');
  vi.advanceTimersByTime(300);
  await vi.waitFor(() => {
    const leadCalls = fetchSpy.mock.calls.filter(([u]) =>
      String(u).includes('/api/admin/leads'),
    );
    expect(leadCalls).toHaveLength(1);
  });
  vi.useRealTimers();
});
```
