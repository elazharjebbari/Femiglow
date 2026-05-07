# scenario-webhooks-list

| Aspect | Valeur |
|---|---|
| Domaine | webhooks |
| Composant | `WebhooksTable` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/WebhooksTable.integration.test.tsx` |
| Référence | F-WH-01 |

## Préconditions
- Utilisateur authentifié sur `/admin/webhooks`.
- 3 endpoints existent en base avec stats agrégées.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('*/api/admin/webhooks', () =>
    HttpResponse.json({
      items: [
        {
          id: 'wh_slack',
          name: 'Slack #leads',
          url: 'https://hooks.slack.com/services/T0/B0/XXXX',
          events: ['lead.created', 'order.created'],
          active: true,
          createdAt: '2026-04-01T10:00:00Z',
          updatedAt: '2026-05-01T10:00:00Z',
          stats: { deliveries24h: 42, failures24h: 0, lastSuccessAt: '2026-05-03T13:55:00Z' },
        },
        {
          id: 'wh_zapier',
          name: 'Zapier CRM',
          url: 'https://hooks.zapier.com/hooks/catch/123/abc',
          events: ['lead.created'],
          active: true,
          createdAt: '2026-04-15T10:00:00Z',
          updatedAt: '2026-04-15T10:00:00Z',
          stats: { deliveries24h: 12, failures24h: 3, lastSuccessAt: '2026-05-03T12:00:00Z' },
        },
        {
          id: 'wh_paused',
          name: 'Test endpoint',
          url: 'https://example.com/hook',
          events: ['webhook.test'],
          active: false,
          createdAt: '2026-04-20T10:00:00Z',
          updatedAt: '2026-04-21T10:00:00Z',
          stats: { deliveries24h: 0, failures24h: 0, lastSuccessAt: null },
        },
      ],
    }),
  ),
];
```

## Action utilisateur

1. Naviguer vers `/admin/webhooks`.
2. Attendre le rendu de la table.

## Assertions

- 3 lignes sont rendues, chacune avec `data-testid="webhook-row"`.
- Pour chaque ligne : nom, URL tronquée (max 40 caractères), liste d'events en chips.
- Les stats `42 / 0` sont affichées sur la ligne Slack avec un indicateur vert.
- La ligne Zapier affiche `12 / 3` avec un indicateur ambre (failures > 0).
- La ligne `wh_paused` affiche un badge "Inactif" en gris.
- Un bouton "Nouvel endpoint" est visible en haut à droite.

## Edge cases couverts ailleurs

- Création → `scenario-webhook-create.md`
- Toggle actif → `scenario-webhooks-toggle.md`
- Suppression → `scenario-webhooks-delete.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import { WebhooksTable } from './WebhooksTable';

it('rend les 3 endpoints avec leurs stats', async () => {
  render(<WebhooksTable />);
  const rows = await screen.findAllByTestId('webhook-row');
  expect(rows).toHaveLength(3);
  expect(screen.getByText('Slack #leads')).toBeInTheDocument();
  expect(screen.getByText(/inactif/i)).toBeInTheDocument();
});
```
