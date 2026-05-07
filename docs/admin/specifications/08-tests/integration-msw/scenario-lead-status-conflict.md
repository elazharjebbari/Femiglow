# scenario-lead-status-conflict

| Aspect | Valeur |
|---|---|
| Domaine | leads-detail |
| Composant | `StatusMenu` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/StatusMenu.integration.test.tsx` |
| Référence | F-LEADS-09 |

## Préconditions
- Lead `lead_002` avec `status: 'won'`.
- Un autre admin a déjà transitionné le lead à `lost` entre temps.
- L'API rejette la transition `won → spam` (interdite).

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.patch('*/api/admin/leads/lead_002/status', () =>
    HttpResponse.json(
      {
        error: 'conflict',
        issues: [{ path: ['status'], message: 'transition_not_allowed' }],
      },
      { status: 409 },
    ),
  ),
];
```

## Action utilisateur

1. Cliquer le bouton "Statut : Gagné".
2. Choisir "Spam" dans le menu.
3. Attendre la résolution.

## Assertions

- Le badge bascule à "Spam" puis **revient à "Gagné"** après le `409` (rollback optimiste).
- Un toast d'erreur affiche « Transition interdite. Le lead est peut-être déjà mis à jour. »
- Le menu se ré-ouvre automatiquement OU offre un bouton "Recharger".
- Une requête `GET /api/admin/leads/lead_002` est tentée pour resync.
- `router.push` n'est jamais appelé.

## Edge cases couverts ailleurs

- Transition autorisée → `scenario-lead-status-change.md`
- Lead 404 → `e2e/lead-detail-404.spec.ts`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusMenu } from './StatusMenu';

it('rollback optimiste sur 409', async () => {
  const user = userEvent.setup();
  render(<StatusMenu leadId="lead_002" current="won" />);
  await user.click(screen.getByRole('button', { name: /gagné/i }));
  await user.click(screen.getByRole('menuitem', { name: /spam/i }));
  expect(await screen.findByText(/transition interdite/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /gagné/i })).toBeInTheDocument();
});
```
