# scenario-login-failure

| Aspect | Valeur |
|---|---|
| Domaine | auth |
| Composant | `LoginForm` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/LoginForm.integration.test.tsx` |
| Référence | F-AUTH-02 |

## Préconditions
- Utilisateur non authentifié sur `/admin/login`.
- Aucun cookie `femiglow.admin.session` actif.
- DOM monté via `render(<LoginForm />)`.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('*/api/admin/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.password !== 'correct-password') {
      return HttpResponse.json(
        { error: 'unauthorized' },
        { status: 401 },
      );
    }
    return HttpResponse.json({ ok: true, redirect: '/admin/dashboard' });
  }),
];
```

## Action utilisateur

1. Saisir `fondatrice@femiglow.ma` dans le champ e-mail.
2. Saisir `mauvais-password` dans le champ mot de passe.
3. Cliquer le bouton "Se connecter".

## Assertions

- Le bouton "Se connecter" passe en état désactivé pendant la requête puis redevient actif.
- Un message d'erreur générique apparaît dans `[role=alert]` : « Identifiants invalides ».
- Le message d'erreur ne révèle pas si l'e-mail existe (anti-énumération).
- `router.push` n'est jamais appelé.
- Le champ mot de passe est vidé, l'e-mail est conservé.
- Le focus revient sur le champ mot de passe.

## Edge cases couverts ailleurs

- Login réussi → `scenario-login-success.md`
- Trop de tentatives → `scenario-login-rate-limit.md`
- Session déjà active → `scenario-session-expired.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { LoginForm } from './LoginForm';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

it('affiche un message générique sur 401', async () => {
  const user = userEvent.setup();
  render(<LoginForm />);
  await user.type(screen.getByLabelText('Adresse e-mail'), 'fondatrice@femiglow.ma');
  await user.type(screen.getByLabelText('Mot de passe'), 'mauvais-password');
  await user.click(screen.getByRole('button', { name: 'Se connecter' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/identifiants invalides/i);
  expect(push).not.toHaveBeenCalled();
});
```
