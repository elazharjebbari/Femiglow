# scenario-delivery-retry-conflict

| Aspect | Valeur |
|---|---|
| Domaine | deliveries |
| Composant | `RetryButton` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/RetryButton.integration.test.tsx` |
| Référence | F-DEL-05 |

## Préconditions
- Livraison `del_002` en status `delivered` (déjà OK).
- L'admin tente de la renvoyer (cas rare, par erreur).

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('*/api/admin/webhook-deliveries/del_002/retry', () =>
    HttpResponse.json(
      {
        error: 'conflict',
        issues: [{ path: ['status'], message: 'already_delivered' }],
      },
      { status: 409 },
    ),
  ),
];
```

## Action utilisateur

1. Cliquer "Renvoyer" sur la ligne `del_002`.
2. Attendre la résolution.

## Assertions

- Après `409`, un toast d'erreur affiche « Cette livraison a déjà été acceptée. Aucune action nécessaire. »
- Le bouton "Renvoyer" est masqué/désactivé après la réponse.
- Aucune navigation, aucun refetch destructif.
- Idéalement : le bouton n'aurait pas dû être rendu (UX), le `409` est un garde-fou serveur.

## Edge cases couverts ailleurs

- Renvoi succès → `scenario-delivery-retry.md`
- Replay engine → `scenario-delivery-replay.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RetryButton } from './RetryButton';

it('affiche un toast sur 409 already_delivered', async () => {
  const user = userEvent.setup();
  render(<RetryButton deliveryId="del_002" status="delivered" />);
  await user.click(screen.getByRole('button', { name: /renvoyer/i }));
  expect(await screen.findByText(/déjà été acceptée/i)).toBeInTheDocument();
});
```
