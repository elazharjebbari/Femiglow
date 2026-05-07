# scenario-delivery-retry

| Aspect | Valeur |
|---|---|
| Domaine | deliveries |
| Composant | `RetryButton` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/RetryButton.integration.test.tsx` |
| Référence | F-DEL-04 |

## Préconditions
- Livraison `del_001` en status `failed` avec 3/8 tentatives.
- Le drawer ou la table affiche le bouton "Renvoyer".

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('*/api/admin/webhook-deliveries/del_001/retry', () =>
    HttpResponse.json({
      id: 'del_001',
      endpointId: 'wh_slack',
      eventName: 'lead.created',
      status: 'pending',
      attempt: 0,
      maxAttempts: 8,
      scheduledAt: '2026-05-03T14:32:00Z',
      lastAttemptAt: null,
      nextAttemptAt: '2026-05-03T16:00:00Z',
      httpStatus: null,
      durationMs: null,
      responseBody: null,
      idempotencyKey: 'idem_001',
      signature: 'sha256=newhmac',
      payload: {},
    }),
  ),
];
```

## Action utilisateur

1. Cliquer "Renvoyer" dans le drawer (ou ligne table).
2. Attendre la résolution.

## Assertions

- Le bouton passe en état désactivé pendant la requête.
- Après `200`, la livraison est mise à jour : status `pending`, attempt `0`.
- Un toast affiche « Livraison reprogrammée ».
- La table est rafraîchie via refetch (la ligne change de status).
- Le nouveau `nextAttemptAt` est affiché (« Reprogrammée à HH:MM »).
- Aucune confirmation n'est demandée (action non destructive, idempotente).

## Edge cases couverts ailleurs

- Conflit (déjà delivered) → `scenario-delivery-retry-conflict.md`
- Replay manuel côté engine → `scenario-delivery-replay.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RetryButton } from './RetryButton';

it('reprogramme la livraison', async () => {
  const user = userEvent.setup();
  render(<RetryButton deliveryId="del_001" status="failed" />);
  await user.click(screen.getByRole('button', { name: /renvoyer/i }));
  expect(await screen.findByText(/reprogrammée/i)).toBeInTheDocument();
});
```
