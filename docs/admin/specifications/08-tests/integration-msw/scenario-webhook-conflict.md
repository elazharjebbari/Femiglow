# scenario-webhook-conflict

| Aspect | Valeur |
|---|---|
| Domaine | webhooks |
| Composant | `WebhookForm` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/WebhookForm.integration.test.tsx` |
| Référence | F-WH-06 |

## Préconditions
- Utilisateur sur `/admin/webhooks/new`.
- Un endpoint avec la même URL existe déjà en base.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('*/api/admin/webhooks', () =>
    HttpResponse.json(
      {
        error: 'conflict',
        issues: [{ path: ['url'], message: 'url_already_exists' }],
      },
      { status: 409 },
    ),
  ),
];
```

## Action utilisateur

1. Saisir `Doublon Slack` dans "Nom".
2. Saisir `https://hooks.slack.com/services/T0/B0/XXXX` (URL existante).
3. Cocher `lead.created`.
4. Cliquer "Créer".

## Assertions

- La requête `POST` est envoyée.
- Après `409`, le formulaire reste rendu (pas de redirection).
- Le champ "URL" reçoit un état d'erreur (`aria-invalid="true"`).
- Le message d'erreur sous le champ : « Cette URL est déjà utilisée par un autre endpoint. »
- Le focus est replacé sur le champ "URL".
- Aucun toast global n'est rendu (l'erreur est inline).
- Cliquer à nouveau "Créer" sans modifier l'URL ne rejoue pas la requête (validation client).

## Edge cases couverts ailleurs

- Création réussie → `scenario-webhook-create.md`
- Édition (URL inchangée) → `scenario-webhook-edit.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WebhookForm } from './WebhookForm';

it('marque le champ URL en erreur sur 409', async () => {
  const user = userEvent.setup();
  render(<WebhookForm mode="create" />);
  await user.type(screen.getByLabelText(/nom/i), 'Doublon Slack');
  await user.type(screen.getByLabelText(/url/i), 'https://hooks.slack.com/services/T0/B0/XXXX');
  await user.click(screen.getByLabelText('lead.created'));
  await user.click(screen.getByRole('button', { name: /créer/i }));
  const urlInput = screen.getByLabelText(/url/i);
  expect(urlInput).toHaveAttribute('aria-invalid', 'true');
  expect(await screen.findByText(/déjà utilisée/i)).toBeInTheDocument();
});
```
