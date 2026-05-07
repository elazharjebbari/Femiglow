# scenario-logout

| Aspect | Valeur |
|---|---|
| Domaine | auth |
| Composant | `LogoutButton` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/LogoutButton.integration.test.tsx` |
| Référence | F-AUTH-05 |

## Préconditions
- Utilisateur authentifié, header admin rendu.
- Le bouton "Se déconnecter" est visible dans le menu utilisateur.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('*/api/admin/logout', () =>
    HttpResponse.json(
      { ok: true },
      {
        status: 200,
        headers: {
          'Set-Cookie': 'femiglow.admin.session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax',
        },
      },
    ),
  ),
];
```

## Action utilisateur

1. Cliquer sur l'avatar pour ouvrir le menu utilisateur.
2. Cliquer sur l'item "Se déconnecter".
3. Confirmer la déconnexion (si modale de confirmation).

## Assertions

- Le bouton passe en état désactivé pendant la requête.
- `router.push` est appelé avec `'/admin/login'`.
- Le cookie `femiglow.admin.session` est invalidé côté client (`Max-Age=0`).
- Le store local (`zustand` user store) est purgé : `useUserStore.getState().user === null`.
- Aucun toast d'erreur n'apparaît.
- Aucune autre requête API n'est tentée après la déconnexion (cleanup des timers `useSession`).

## Edge cases couverts ailleurs

- Session expirée silencieuse → `scenario-session-expired.md`
- Login après logout → `scenario-login-success.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { LogoutButton } from './LogoutButton';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

it('déconnecte et redirige vers /admin/login', async () => {
  const user = userEvent.setup();
  render(<LogoutButton />);
  await user.click(screen.getByRole('button', { name: /se déconnecter/i }));
  await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/admin/login'));
});
```
