# scenario-login-rate-limit

| Aspect | Valeur |
|---|---|
| Domaine | auth |
| Composant | `LoginForm` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/LoginForm.integration.test.tsx` |
| Référence | F-AUTH-03 |

## Préconditions
- L'utilisateur a déjà déclenché 5 échecs de login dans la fenêtre de 15 minutes.
- L'API renvoie `429` avec un header `Retry-After` (en secondes).

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('*/api/admin/login', () =>
    HttpResponse.json(
      { error: 'rate_limited' },
      {
        status: 429,
        headers: {
          'Retry-After': '300',
          'X-RateLimit-Remaining': '0',
        },
      },
    ),
  ),
];
```

## Action utilisateur

1. Saisir une adresse e-mail valide.
2. Saisir un mot de passe.
3. Cliquer "Se connecter".

## Assertions

- Le bouton "Se connecter" devient désactivé pendant 300 s (compteur affiché).
- Un `[role=alert]` indique : « Trop de tentatives. Réessayez dans 5 min. »
- Le message annonce le délai humanisé via `Retry-After`.
- `router.push` n'est jamais appelé.
- Le composant lit `Retry-After` via `response.headers.get('Retry-After')`.
- Le compteur décrémente chaque seconde et le bouton se réactive à 0.

## Edge cases couverts ailleurs

- Login réussi → `scenario-login-success.md`
- Mauvais identifiants → `scenario-login-failure.md`
- Stats DB côté admin → `scenario-rate-limit-login.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { LoginForm } from './LoginForm';

it('verrouille le formulaire pendant Retry-After', async () => {
  vi.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<LoginForm />);
  await user.type(screen.getByLabelText('Adresse e-mail'), 'fondatrice@femiglow.ma');
  await user.type(screen.getByLabelText('Mot de passe'), 'whatever-pass');
  await user.click(screen.getByRole('button', { name: 'Se connecter' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/5 min/);
  expect(screen.getByRole('button', { name: /se connecter/i })).toBeDisabled();
  vi.advanceTimersByTime(300_000);
  expect(screen.getByRole('button', { name: /se connecter/i })).toBeEnabled();
  vi.useRealTimers();
});
```
