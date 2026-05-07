# scenario-public-newsletter

| Aspect | Valeur |
|---|---|
| Domaine | public |
| Composant | `NewsletterForm` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/public/NewsletterForm.integration.test.tsx` |
| Référence | F-PUB-03 |

## Préconditions
- Composant `NewsletterForm` rendu (footer ou page dédiée).
- Champs minimaux : e-mail + consentement.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('*/api/public/newsletter', async () =>
    HttpResponse.json(
      { ok: true, leadId: 'lead_news_001' },
      { status: 201 },
    ),
  ),
];
```

## Action utilisateur

1. Saisir une adresse e-mail valide.
2. Cocher le consentement.
3. Cliquer "S'inscrire".

## Assertions

- Le body envoyé contient `email`, `consentAt`.
- Après `201`, le formulaire affiche un message inline : « Inscription confirmée. »
- L'input est vidé.
- Côté serveur : 1 lead `type: 'newsletter'` + 1 event `newsletter.subscribed` enqueue.
- Si l'e-mail est déjà inscrit, l'API renvoie quand même `201` (idempotent côté UX, déduplication serveur).
- Validation client : e-mail invalide → erreur sous le champ, pas de requête.

## Edge cases couverts ailleurs

- Sans consentement → `scenario-public-no-consent.md`
- Rate limit → `scenario-public-rate-limit.md`
- Contact → `scenario-public-contact.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewsletterForm } from './NewsletterForm';

it('inscrit à la newsletter avec consentement', async () => {
  const user = userEvent.setup();
  render(<NewsletterForm />);
  await user.type(screen.getByLabelText(/e-mail/i), 'fan@example.ma');
  await user.click(screen.getByLabelText(/politique/i));
  await user.click(screen.getByRole('button', { name: /s'inscrire/i }));
  expect(await screen.findByText(/inscription confirmée/i)).toBeInTheDocument();
});
```
