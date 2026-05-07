# scenario-session-expired

| Aspect | Valeur |
|---|---|
| Domaine | auth |
| Composant | `useSession` (hook + `SessionGuard`) |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/lib/auth/__tests__/useSession.integration.test.tsx` |
| Référence | F-AUTH-04 |

## Préconditions
- Utilisateur initialement authentifié, page admin chargée.
- Pendant la navigation, le cookie de session expire (TTL 24 h).
- Le hook `useSession` re-poll `/api/admin/session` toutes les 60 s.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

let callCount = 0;

export const handlers = [
  http.get('*/api/admin/session', () => {
    callCount += 1;
    if (callCount === 1) {
      return HttpResponse.json({
        user: { id: 'usr_001', email: 'fondatrice@femiglow.ma', name: 'Fondatrice' },
      });
    }
    return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
  }),
];
```

## Action utilisateur

1. La page `/admin/leads` est chargée, session valide.
2. L'utilisateur reste inactif suffisamment longtemps (60 s simulés).
3. Le hook re-poll la session ; le serveur répond `401`.

## Assertions

- Le hook détecte le `401` et bascule `state.status === 'expired'`.
- Le composant `SessionGuard` redirige vers `/admin/login?next=/admin/leads`.
- Un toast neutre s'affiche : « Votre session a expiré. Reconnectez-vous. »
- Aucun appel mutation n'est tenté pendant la transition.
- Le cookie côté client est nettoyé via `document.cookie` ou ignoré (HttpOnly côté serveur).

## Edge cases couverts ailleurs

- Logout volontaire → `scenario-logout.md`
- Login après expiration → `scenario-login-success.md`
- 401 sur mutation isolée → `scenario-lead-status-conflict.md` (variante)

## Notes d'implémentation

```ts
import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useSession } from '@/lib/auth/useSession';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/admin/leads',
}));

it('redirige vers login quand la session expire', async () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useSession({ pollMs: 60_000 }));
  await waitFor(() => expect(result.current.status).toBe('authenticated'));
  vi.advanceTimersByTime(60_000);
  await waitFor(() => expect(result.current.status).toBe('expired'));
  expect(replace).toHaveBeenCalledWith('/admin/login?next=/admin/leads');
  vi.useRealTimers();
});
```
