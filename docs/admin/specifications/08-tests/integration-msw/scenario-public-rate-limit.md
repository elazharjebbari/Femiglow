# scenario-public-rate-limit

| Aspect | Valeur |
|---|---|
| Domaine | public |
| Composant | `ContactForm` (rate limit) |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/public/ContactForm.integration.test.tsx` |
| Référence | F-PUB-05 |

## Préconditions
- L'IP cliente a déjà soumis 10 requêtes valides dans la dernière heure.
- La 11e tentative déclenche le rate limit serveur.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('*/api/public/contact', () =>
    HttpResponse.json(
      { error: 'rate_limited' },
      {
        status: 429,
        headers: {
          'Retry-After': '1800',
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
        },
      },
    ),
  ),
];
```

## Action utilisateur

1. Remplir le formulaire correctement.
2. Cliquer "Envoyer".

## Assertions

- Après `429`, un message d'erreur affiche : « Vous avez atteint le nombre maximal d'envois. Réessayez dans 30 min. »
- Le délai humain est calculé depuis `Retry-After` (1800 s).
- Le bouton "Envoyer" reste désactivé pendant 1800 s (compteur affiché).
- Les valeurs du formulaire sont conservées (l'utilisateur ne les retape pas).
- Aucune nouvelle requête n'est tentée tant que le délai n'est pas écoulé.

## Edge cases couverts ailleurs

- Sans consent → `scenario-public-no-consent.md`
- Soumission valide → `scenario-public-contact.md`
- Stats DB rate limit → `scenario-rate-limit-public.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ContactForm } from './ContactForm';

it('verrouille le formulaire après 429', async () => {
  vi.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<ContactForm />);
  await user.type(screen.getByLabelText(/nom/i), 'Test');
  await user.type(screen.getByLabelText(/e-mail/i), 'test@example.ma');
  await user.type(screen.getByLabelText(/message/i), 'msg');
  await user.click(screen.getByLabelText(/politique/i));
  await user.click(screen.getByRole('button', { name: /envoyer/i }));
  expect(await screen.findByText(/30 min/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /envoyer/i })).toBeDisabled();
  vi.useRealTimers();
});
```
