# scenario-webhooks-delete

| Aspect | Valeur |
|---|---|
| Domaine | webhooks |
| Composant | `DeleteWebhookDialog` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/DeleteWebhookDialog.integration.test.tsx` |
| Référence | F-WH-03 |

## Préconditions
- Endpoint `wh_zapier` actif.
- Action "Supprimer" disponible dans le menu contextuel de la ligne.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.delete('*/api/admin/webhooks/wh_zapier', () =>
    new HttpResponse(null, { status: 204 }),
  ),
];
```

## Action utilisateur

1. Ouvrir le menu contextuel de la ligne `wh_zapier`.
2. Cliquer "Supprimer".
3. La modale de confirmation s'ouvre.
4. Saisir le nom exact de l'endpoint (`Zapier CRM`) dans le champ de confirmation.
5. Cliquer "Supprimer définitivement".

## Assertions

- La modale est rendue avec `role="dialog"` et `aria-modal="true"`.
- Le bouton "Supprimer définitivement" est désactivé tant que le nom saisi ne correspond pas.
- La requête `DELETE` est envoyée vers `/api/admin/webhooks/wh_zapier`.
- Après succès `204`, la modale se ferme.
- La ligne disparaît de la table (refetch ou removal local).
- Un toast affiche « Endpoint supprimé ».
- Les livraisons `pending` côté serveur sont annulées (mention dans le texte de la modale).

## Edge cases couverts ailleurs

- 404 (endpoint déjà supprimé) → variante du même scénario.
- Toggle actif → `scenario-webhooks-toggle.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteWebhookDialog } from './DeleteWebhookDialog';

it('exige le nom exact pour confirmer', async () => {
  const user = userEvent.setup();
  render(<DeleteWebhookDialog id="wh_zapier" name="Zapier CRM" open onClose={() => {}} />);
  const button = screen.getByRole('button', { name: /supprimer définitivement/i });
  expect(button).toBeDisabled();
  await user.type(screen.getByLabelText(/nom de l'endpoint/i), 'Zapier CRM');
  expect(button).toBeEnabled();
  await user.click(button);
  expect(await screen.findByText(/endpoint supprimé/i)).toBeInTheDocument();
});
```
