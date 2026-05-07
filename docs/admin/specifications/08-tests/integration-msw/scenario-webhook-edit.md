# scenario-webhook-edit

| Aspect | Valeur |
|---|---|
| Domaine | webhooks |
| Composant | `WebhookForm` (mode édition) |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/WebhookForm.integration.test.tsx` |
| Référence | F-WH-05 |

## Préconditions
- Utilisateur sur `/admin/webhooks/wh_slack/edit`.
- Le formulaire est pré-rempli avec les valeurs actuelles.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('*/api/admin/webhooks/wh_slack', () =>
    HttpResponse.json({
      id: 'wh_slack',
      name: 'Slack #leads',
      url: 'https://hooks.slack.com/services/T0/B0/XXXX',
      events: ['lead.created'],
      active: true,
      createdAt: '2026-04-01T10:00:00Z',
      updatedAt: '2026-05-01T10:00:00Z',
    }),
  ),
  http.patch('*/api/admin/webhooks/wh_slack', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: 'wh_slack',
      name: 'Slack #leads',
      url: 'https://hooks.slack.com/services/T0/B0/XXXX',
      events: ['lead.created', 'order.created'],
      active: true,
      createdAt: '2026-04-01T10:00:00Z',
      updatedAt: '2026-05-03T16:00:00Z',
      ...body,
    });
  }),
];
```

## Action utilisateur

1. Charger `/admin/webhooks/wh_slack/edit`.
2. Cocher l'event `order.created` en plus.
3. Cliquer "Enregistrer".

## Assertions

- Le formulaire est pré-rempli (nom, URL, events cochés).
- Le secret n'est **pas** affiché (champ absent en mode édition).
- La requête `PATCH` envoie uniquement les champs modifiés (`events`).
- Après succès, un toast « Endpoint mis à jour » apparaît.
- L'utilisateur est redirigé vers `/admin/webhooks`.
- Si aucune modification, le bouton "Enregistrer" est désactivé (form `dirty`).

## Edge cases couverts ailleurs

- Conflit URL → `scenario-webhook-conflict.md`
- Création → `scenario-webhook-create.md`
- Rotation secret → `scenario-webhook-rotate.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WebhookForm } from './WebhookForm';

it('met à jour les events cochés', async () => {
  const user = userEvent.setup();
  render(<WebhookForm mode="edit" id="wh_slack" />);
  expect(await screen.findByDisplayValue('Slack #leads')).toBeInTheDocument();
  await user.click(screen.getByLabelText('order.created'));
  await user.click(screen.getByRole('button', { name: /enregistrer/i }));
  expect(await screen.findByText(/endpoint mis à jour/i)).toBeInTheDocument();
});
```
