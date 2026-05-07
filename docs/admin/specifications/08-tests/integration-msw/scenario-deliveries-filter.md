# scenario-deliveries-filter

| Aspect | Valeur |
|---|---|
| Domaine | deliveries |
| Composant | `DeliveriesTable` (filtres) |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/DeliveriesTable.integration.test.tsx` |
| Référence | F-DEL-02 |

## Préconditions
- Utilisateur sur `/admin/webhooks/wh_slack/deliveries`.
- Filtres disponibles : `status`, `event`, `http_code`.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('*/api/admin/webhooks/wh_slack/deliveries', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const event = url.searchParams.get('event');
    const httpCode = url.searchParams.get('http_code');
    if (status === 'failed' && event === 'lead.created' && httpCode === '500') {
      return HttpResponse.json({
        items: [
          {
            id: 'del_failed_500',
            endpointId: 'wh_slack',
            eventName: 'lead.created',
            status: 'failed',
            attempt: 2,
            maxAttempts: 8,
            scheduledAt: '2026-05-03T14:32:00Z',
            lastAttemptAt: '2026-05-03T14:32:01Z',
            nextAttemptAt: '2026-05-03T14:35:00Z',
            httpStatus: 500,
            durationMs: 200,
            responseBody: 'Internal Error',
            idempotencyKey: 'idem_x',
            signature: 'sha256=abc',
            payload: {},
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

1. Ouvrir le menu "Statut" et sélectionner "Failed".
2. Ouvrir "Event" et sélectionner `lead.created`.
3. Saisir `500` dans le champ "Code HTTP".
4. Attendre le rafraîchissement.

## Assertions

- L'URL est mise à jour : `?status=failed&event=lead.created&http_code=500`.
- Une seule requête est faite après la combinaison (debounce sur `http_code`).
- 1 ligne est rendue : `del_failed_500`.
- Un compteur affiche « 1 résultat ».
- Cliquer "Réinitialiser" purge tous les filtres et l'URL.
- `http_code` non numérique → ignoré silencieusement.

## Edge cases couverts ailleurs

- Drawer détail → `scenario-delivery-detail.md`
- Renvoyer → `scenario-delivery-retry.md`
- Liste pleine → `scenario-deliveries-list.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeliveriesTable } from './DeliveriesTable';

it('filtre par status + event + http_code', async () => {
  const user = userEvent.setup();
  render(<DeliveriesTable endpointId="wh_slack" />);
  await user.selectOptions(screen.getByLabelText('Statut'), 'failed');
  await user.selectOptions(screen.getByLabelText('Event'), 'lead.created');
  await user.type(screen.getByLabelText(/code http/i), '500');
  expect(await screen.findByText('del_failed_500')).toBeInTheDocument();
});
```
