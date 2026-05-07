# scenario-login-success

| Aspect | Valeur |
|---|---|
| Domaine | auth |
| Composant | `LoginForm` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/LoginForm.integration.test.tsx` |
| Référence | F-AUTH-01 |

## Préconditions
- Utilisateur non authentifié (page `/admin/login` rendue).
- DOM monté via `render(<LoginForm />)` avec `MemoryRouterProvider`.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('*/api/admin/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    if (body.email === 'fondatrice@femiglow.ma' && body.password === 'correct-password') {
      return HttpResponse.json(
        { ok: true, redirect: '/admin/dashboard' },
        { status: 200, headers: { 'Set-Cookie': 'femiglow.admin.session=…' } },
      );
    }
    return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
  }),
];
```

## Action utilisateur

1. Saisir `fondatrice@femiglow.ma` dans le champ email.
2. Saisir `correct-password` dans le champ mot de passe.
3. Cliquer le bouton "Se connecter".

## Assertions

- Le bouton "Se connecter" passe en état désactivé pendant la requête.
- Aucun message d'erreur n'apparaît (pas d'élément `[role=alert]`).
- La fonction `router.push` est appelée avec `'/admin/dashboard'`.
- Le formulaire ne contient plus de valeurs après redirection.

## Edge cases couverts ailleurs

- Identifiants invalides → `scenario-login-failure.md`
- Trop de tentatives → `scenario-login-rate-limit.md`
- Latence simulée → variante du même scénario avec `delay(800)`.

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { LoginForm } from './LoginForm';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

it('logs in successfully and redirects to dashboard', async () => {
  const user = userEvent.setup();
  render(<LoginForm />);
  await user.type(screen.getByLabelText('Adresse e-mail'), 'fondatrice@femiglow.ma');
  await user.type(screen.getByLabelText('Mot de passe'), 'correct-password');
  await user.click(screen.getByRole('button', { name: 'Se connecter' }));
  await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/admin/dashboard'));
});
```
