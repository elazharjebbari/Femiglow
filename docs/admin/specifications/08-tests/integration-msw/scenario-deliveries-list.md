# scenario-deliveries-list

| Aspect | Valeur |
|---|---|
| Domaine | deliveries |
| Composant | `DeliveriesTable` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/DeliveriesTable.integration.test.tsx` |
| Référence | F-DEL-01 |

## Préconditions
- Utilisateur authentifié sur `/admin/webhooks/wh_slack/deliveries`.
- 25 livraisons existent pour cet endpoint.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('*/api/admin/webhooks/wh_slack/deliveries', ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    if (cursor) {
      return HttpResponse.json({ items: [], nextCursor: null });
    }
    return HttpResponse.json({
      items: Array.from({ length: 20 }, (_, i) => ({
        id: `del_${i.toString().padStart(3, '0')}`,
        endpointId: 'wh_slack',
        eventName: i % 2 === 0 ? 'lead.created' : 'order.created',
        status: i < 18 ? 'delivered' : 'failed',
        attempt: i < 18 ? 1 : 3,
        maxAttempts: 8,
        scheduledAt: '2026-05-03T14:32:00Z',
        lastAttemptAt: '2026-05-03T14:32:01Z',
        nextAttemptAt: i < 18 ? null : '2026-05-03T14:35:00Z',
        httpStatus: i < 18 ? 200 : 500,
        durationMs: 142,
        responseBody: 'ok',
        idempotencyKey: `idem_${i}`,
        signature: 'sha256=abc',
        payload: {},
      })),
      nextCursor: 'cur_p2',
    });
  }),
];
```

## Action utilisateur

1. Naviguer vers `/admin/webhooks/wh_slack/deliveries`.
2. Attendre le rendu de la table.

## Assertions

- 20 lignes `[data-testid="delivery-row"]` rendues.
- Chaque ligne affiche : event, status (badge coloré), attempt/maxAttempts, httpStatus, durée.
- Les statuts `delivered` ont un badge vert, `failed` rouge, `pending` ambre, `dead` gris.
- Le bouton "Suivant" est actif (`nextCursor` non null).
- Cliquer une ligne ouvre le drawer de détail (cf. `scenario-delivery-detail.md`).

## Edge cases couverts ailleurs

- Filtre statut → `scenario-deliveries-filter.md`
- Drawer détail → `scenario-delivery-detail.md`
- Renvoyer → `scenario-delivery-retry.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import { DeliveriesTable } from './DeliveriesTable';

it('rend 20 livraisons avec leurs badges', async () => {
  render(<DeliveriesTable endpointId="wh_slack" />);
  const rows = await screen.findAllByTestId('delivery-row');
  expect(rows).toHaveLength(20);
});
```
