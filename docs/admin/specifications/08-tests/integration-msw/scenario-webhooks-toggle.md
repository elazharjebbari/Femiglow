# scenario-webhooks-toggle

| Aspect | Valeur |
|---|---|
| Domaine | webhooks |
| Composant | `WebhookToggle` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/WebhookToggle.integration.test.tsx` |
| Référence | F-WH-02 |

## Préconditions
- L'endpoint `wh_slack` est actif.
- Le toggle est rendu sur la ligne correspondante de la table.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.patch('*/api/admin/webhooks/wh_slack', async ({ request }) => {
    const body = (await request.json()) as { active?: boolean };
    return HttpResponse.json({
      id: 'wh_slack',
      name: 'Slack #leads',
      url: 'https://hooks.slack.com/services/T0/B0/XXXX',
      events: ['lead.created'],
      active: body.active ?? true,
      createdAt: '2026-04-01T10:00:00Z',
      updatedAt: '2026-05-03T16:00:00Z',
    });
  }),
];
```

## Action utilisateur

1. Cliquer le toggle "Actif" de la ligne Slack.
2. Attendre la confirmation.

## Assertions

- Le toggle bascule visuellement **immédiatement** (optimistic).
- La requête `PATCH` envoie `{ active: false }`.
- Après réponse `200`, un toast affiche « Endpoint désactivé ».
- En cas d'erreur 500, le toggle revient à son état précédent + toast d'erreur.
- Pendant la requête, le toggle est désactivé pour éviter le double-clic.
- Aucune confirmation n'est demandée (action non destructive).

## Edge cases couverts ailleurs

- Suppression (avec modale) → `scenario-webhooks-delete.md`
- Édition complète → `scenario-webhook-edit.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WebhookToggle } from './WebhookToggle';

it('bascule actif/inactif de manière optimiste', async () => {
  const user = userEvent.setup();
  render(<WebhookToggle id="wh_slack" active={true} />);
  const toggle = screen.getByRole('switch', { name: /actif/i });
  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(await screen.findByText(/endpoint désactivé/i)).toBeInTheDocument();
});
```
