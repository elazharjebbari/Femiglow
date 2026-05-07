# scenario-webhook-rotate

| Aspect | Valeur |
|---|---|
| Domaine | webhooks |
| Composant | `RotateSecretButton` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/RotateSecretButton.integration.test.tsx` |
| Référence | F-WH-08 |

## Préconditions
- Endpoint `wh_slack` existant.
- Bouton "Régénérer le secret" rendu sur la page de détail.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('*/api/admin/webhooks/wh_slack/rotate-secret', () =>
    HttpResponse.json({ secret: 'whsec_NEW1234567890abcdef1234567890ab' }),
  ),
];
```

## Action utilisateur

1. Cliquer "Régénérer le secret".
2. Une modale d'avertissement s'ouvre : « L'ancien secret sera invalide immédiatement. »
3. Cliquer "Confirmer la rotation".

## Assertions

- La modale exige une confirmation explicite (pas de double-clic accidentel).
- La requête `POST /rotate-secret` est envoyée sans body.
- Après `200`, le nouveau secret est affiché en clair, **une seule fois**.
- Un bouton "Copier" est rendu et utilise `navigator.clipboard.writeText`.
- Un texte d'avertissement rappelle de mettre à jour le service consommateur.
- Après fermeture de la modale, le secret n'est plus accessible (composant démonté).
- Un toast affiche « Secret régénéré ».

## Edge cases couverts ailleurs

- Création initiale (avec secret) → `scenario-webhook-create.md`
- Vérification signature consommateur → `scenario-delivery-signature-check.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RotateSecretButton } from './RotateSecretButton';

it('régénère et affiche le nouveau secret une fois', async () => {
  const user = userEvent.setup();
  render(<RotateSecretButton id="wh_slack" />);
  await user.click(screen.getByRole('button', { name: /régénérer/i }));
  await user.click(screen.getByRole('button', { name: /confirmer/i }));
  expect(await screen.findByText(/whsec_NEW1234/)).toBeInTheDocument();
});
```
