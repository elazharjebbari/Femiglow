# scenario-delivery-detail

| Aspect | Valeur |
|---|---|
| Domaine | deliveries |
| Composant | `DeliveryDrawer` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/DeliveryDrawer.integration.test.tsx` |
| Référence | F-DEL-03 |

## Préconditions
- Liste des livraisons rendue, livraison `del_001` cliquée.
- Le drawer s'ouvre à droite avec le détail.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('*/api/admin/webhooks/wh_slack/deliveries', ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get('id') === 'del_001') {
      return HttpResponse.json({
        items: [
          {
            id: 'del_001',
            endpointId: 'wh_slack',
            eventName: 'lead.created',
            status: 'failed',
            attempt: 3,
            maxAttempts: 8,
            scheduledAt: '2026-05-03T14:32:00Z',
            lastAttemptAt: '2026-05-03T14:35:00Z',
            nextAttemptAt: '2026-05-03T14:40:00Z',
            httpStatus: 500,
            durationMs: 1240,
            responseBody: '{"error":"upstream"}',
            idempotencyKey: 'idem_001',
            signature: 'sha256=base64encodedhmac',
            payload: { lead: { id: 'lead_001', email: 'leila@example.ma' } },
          },
        ],
        nextCursor: null,
      });
    }
    return HttpResponse.json({ items: [], nextCursor: null });
  }),
];
```

## Action utilisateur

1. Cliquer la ligne `del_001` de la table.
2. Le drawer s'ouvre.

## Assertions

- Le drawer a `role="dialog"` et `aria-labelledby` pointant vers le titre.
- Sections rendues : "Métadonnées", "Payload", "Réponse", "Signature".
- La section Payload est un `<pre>` avec le JSON formaté indenté.
- La signature `sha256=...` est tronquée avec un bouton "Copier".
- Le bouton "Renvoyer" est rendu (sauf si status === 'delivered').
- Le bouton "Fermer" et la touche `Esc` ferment le drawer.
- Le focus est trappé dans le drawer (focus trap).

## Edge cases couverts ailleurs

- Action renvoyer → `scenario-delivery-retry.md`
- Conflit renvoyer → `scenario-delivery-retry-conflict.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeliveryDrawer } from './DeliveryDrawer';

it('affiche payload, réponse, signature dans le drawer', async () => {
  const user = userEvent.setup();
  render(<DeliveryDrawer deliveryId="del_001" open onClose={() => {}} />);
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText(/lead@example/i)).toBeInTheDocument();
  await user.keyboard('{Escape}');
});
```
