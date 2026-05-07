# scenario-lead-status-change

| Aspect | Valeur |
|---|---|
| Domaine | leads-detail |
| Composant | `StatusMenu` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/StatusMenu.integration.test.tsx` |
| Référence | F-LEADS-08 |

## Préconditions
- Lead `lead_001` chargé avec `status: 'new'`.
- L'UI utilise une mutation optimiste (TanStack Query ou store).

## Handlers MSW

```ts
import { http, HttpResponse, delay } from 'msw';
import { makeLead } from '@/test/msw/factories/lead';

export const handlers = [
  http.patch('*/api/admin/leads/lead_001/status', async ({ request }) => {
    const body = (await request.json()) as { status: string; reason?: string };
    await delay(400);
    return HttpResponse.json(
      makeLead({ id: 'lead_001', status: body.status as any }),
    );
  }),
];
```

## Action utilisateur

1. Cliquer le bouton "Statut : Nouveau".
2. Choisir "En cours" dans le menu.
3. Attendre la confirmation.

## Assertions

- Le badge passe à "En cours" **immédiatement** (optimistic).
- Le menu se ferme après le clic.
- Pendant la requête, un spinner discret est rendu à côté du badge.
- Après succès (`200`), le toast affiche « Statut mis à jour ».
- La timeline reçoit un nouvel événement `status_change` (refetch).
- En cas d'erreur 500, le badge revient à "Nouveau" + toast d'erreur.

## Edge cases couverts ailleurs

- Conflit de transition → `scenario-lead-status-conflict.md`
- Détail lead → `scenario-lead-detail-load.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusMenu } from './StatusMenu';

it('met à jour le statut de manière optimiste', async () => {
  const user = userEvent.setup();
  render(<StatusMenu leadId="lead_001" current="new" />);
  await user.click(screen.getByRole('button', { name: /nouveau/i }));
  await user.click(screen.getByRole('menuitem', { name: /en cours/i }));
  expect(screen.getByText(/en cours/i)).toBeInTheDocument();
  expect(await screen.findByText(/statut mis à jour/i)).toBeInTheDocument();
});
```
