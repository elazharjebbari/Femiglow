# scenario-public-no-consent

| Aspect | Valeur |
|---|---|
| Domaine | public |
| Composant | `ContactForm` (validation) |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/public/ContactForm.integration.test.tsx` |
| Référence | F-PUB-04 |

## Préconditions
- Formulaire `ContactForm` rendu.
- L'utilisateur remplit tous les champs **sauf** la case de consentement RGPD.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Le serveur garde un filet de sécurité même si le client valide.
  http.post('*/api/public/contact', () =>
    HttpResponse.json(
      {
        error: 'validation_failed',
        issues: [{ path: ['consentAt'], message: 'consent_required' }],
      },
      { status: 400 },
    ),
  ),
];
```

## Action utilisateur

1. Saisir nom, e-mail, téléphone, message.
2. **Ne pas** cocher la case de consentement.
3. Cliquer "Envoyer".

## Assertions

### Validation client (priorité)
- Le bouton "Envoyer" reste désactivé tant que la case n'est pas cochée.
- OU si activé, le clic affiche une erreur sous la case : « Vous devez accepter la politique pour envoyer ce formulaire. »
- **Aucune requête HTTP** n'est émise.

### Filet serveur (test du cas où le client est contourné)
- Si la requête est forcée sans `consentAt`, le serveur renvoie `400 validation_failed`.
- Le composant affiche un toast d'erreur générique « Vérifiez les champs du formulaire. »

## Edge cases couverts ailleurs

- Soumission valide → `scenario-public-contact.md`
- Order sans consent → variante du même test sur `OrderForm`.

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactForm } from './ContactForm';

it('bloque la soumission sans consentement (client)', async () => {
  const user = userEvent.setup();
  const fetchSpy = vi.spyOn(global, 'fetch');
  render(<ContactForm />);
  await user.type(screen.getByLabelText(/nom/i), 'Leïla');
  await user.type(screen.getByLabelText(/e-mail/i), 'leila@example.ma');
  await user.type(screen.getByLabelText(/message/i), 'Hello');
  await user.click(screen.getByRole('button', { name: /envoyer/i }));
  expect(screen.getByText(/devez accepter/i)).toBeInTheDocument();
  expect(fetchSpy).not.toHaveBeenCalled();
});
```
