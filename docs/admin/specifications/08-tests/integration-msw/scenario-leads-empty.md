# scenario-leads-empty

| Aspect | Valeur |
|---|---|
| Domaine | leads |
| Composant | `LeadTable` (empty state) |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/LeadTable.integration.test.tsx` |
| Référence | F-LEADS-05 |

## Préconditions
- Utilisateur authentifié, navigue vers `/admin/leads?type=b2b&status=won`.
- Aucun lead ne correspond à ces filtres.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('*/api/admin/leads', () =>
    HttpResponse.json({ items: [], nextCursor: null, total: 0 }),
  ),
];
```

## Action utilisateur

1. Charger `/admin/leads?type=b2b&status=won`.
2. Attendre la fin du chargement.

## Assertions

- Aucune ligne `[data-testid="lead-row"]` n'est rendue.
- L'empty state est affiché : illustration + titre « Aucun lead trouvé ».
- Un texte d'aide propose de réinitialiser les filtres.
- Un bouton "Réinitialiser les filtres" est visible.
- Cliquer le bouton appelle `router.replace('/admin/leads')` (URL nue).
- Le compteur affiche « 0 résultat ».
- Aucun bouton de pagination n'est rendu.

## Edge cases couverts ailleurs

- Liste pleine → `scenario-leads-list.md`
- Filtres actifs → `scenario-leads-filters.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams('type=b2b&status=won'),
  usePathname: () => '/admin/leads',
}));

it('affiche lempty state et permet de réinitialiser', async () => {
  const user = userEvent.setup();
  render(<LeadTable />);
  expect(await screen.findByText(/aucun lead trouvé/i)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /réinitialiser/i }));
  expect(replace).toHaveBeenCalledWith('/admin/leads');
});
```
