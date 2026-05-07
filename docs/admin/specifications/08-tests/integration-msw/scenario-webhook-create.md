# scenario-webhook-create

| Aspect | Valeur |
|---|---|
| Domaine | webhooks |
| Composant | `WebhookForm` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/WebhookForm.integration.test.tsx` |
| Référence | F-WH-04 |

## Préconditions
- Utilisateur sur `/admin/webhooks/new`.
- Le formulaire est rendu en mode création.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('*/api/admin/webhooks', async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      url: string;
      events: string[];
    };
    return HttpResponse.json(
      {
        id: 'wh_new',
        name: body.name,
        url: body.url,
        events: body.events,
        active: true,
        createdAt: '2026-05-03T16:00:00Z',
        updatedAt: '2026-05-03T16:00:00Z',
        secret: 'whsec_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
      },
      { status: 201 },
    );
  }),
];
```

## Action utilisateur

1. Saisir `CRM Slack` dans le champ "Nom".
2. Saisir `https://hooks.slack.com/services/T1/B1/yyyy` dans "URL".
3. Cocher l'event `lead.created`.
4. Cliquer "Créer".

## Assertions

- La requête `POST` envoie le body validé Zod.
- Après `201`, une modale "Secret créé" est rendue.
- Le secret `whsec_a1b2c3...` est affiché en clair, **une seule fois**.
- Un bouton "Copier" copie le secret dans le presse-papier (`navigator.clipboard.writeText`).
- Un texte d'avertissement explique que le secret ne sera plus visible.
- Après fermeture de la modale, redirection vers `/admin/webhooks`.
- La table est rafraîchie via refetch.

## Edge cases couverts ailleurs

- URL en conflit → `scenario-webhook-conflict.md`
- Édition → `scenario-webhook-edit.md`
- Rotation secret → `scenario-webhook-rotate.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { WebhookForm } from './WebhookForm';

it('crée un endpoint et affiche le secret', async () => {
  const user = userEvent.setup();
  render(<WebhookForm mode="create" />);
  await user.type(screen.getByLabelText(/nom/i), 'CRM Slack');
  await user.type(screen.getByLabelText(/url/i), 'https://hooks.slack.com/services/T1/B1/yyyy');
  await user.click(screen.getByLabelText('lead.created'));
  await user.click(screen.getByRole('button', { name: /créer/i }));
  expect(await screen.findByText(/whsec_a1b2c3/)).toBeInTheDocument();
});
```
