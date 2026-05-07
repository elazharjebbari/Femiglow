# scenario-webhook-test

| Aspect | Valeur |
|---|---|
| Domaine | webhooks |
| Composant | `TestButton` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/TestButton.integration.test.tsx` |
| Référence | F-WH-07 |

## Préconditions
- Endpoint `wh_slack` existant et actif.
- Bouton "Tester" rendu sur la page de détail de l'endpoint.

## Handlers MSW

```ts
import { http, HttpResponse, delay } from 'msw';

export const handlers = [
  http.post('*/api/admin/webhooks/wh_slack/test', async () => {
    await delay(180);
    return HttpResponse.json({
      httpStatus: 200,
      latencyMs: 142,
      responseBody: '{"ok":true}',
    });
  }),
];
```

## Action utilisateur

1. Cliquer le bouton "Tester l'endpoint".
2. Attendre la résolution.

## Assertions

- Le bouton passe en état désactivé pendant la requête, avec un libellé « Test en cours… ».
- Après succès, un panneau `role="status"` affiche : `httpStatus: 200`, `latencyMs: 142 ms`.
- Le `responseBody` est rendu dans un `<pre>` (max 200 lignes affichées).
- Un badge vert "Succès" est rendu.
- En cas de `502 endpoint_unreachable`, un badge rouge "Endpoint injoignable" remplace le résultat.
- Le rate-limit côté UI : 10 clics/minute → bouton désactivé localement.

## Edge cases couverts ailleurs

- Endpoint 502 → variante du même scénario.
- Création (qui ne déclenche pas de test) → `scenario-webhook-create.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestButton } from './TestButton';

it('ping lendpoint et affiche httpStatus + latency', async () => {
  const user = userEvent.setup();
  render(<TestButton id="wh_slack" />);
  await user.click(screen.getByRole('button', { name: /tester/i }));
  expect(await screen.findByText(/200/)).toBeInTheDocument();
  expect(screen.getByText(/142 ms/i)).toBeInTheDocument();
});
```
