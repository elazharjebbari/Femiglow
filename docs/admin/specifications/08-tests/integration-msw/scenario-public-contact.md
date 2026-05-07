# scenario-public-contact

| Aspect | Valeur |
|---|---|
| Domaine | public |
| Composant | `ContactForm` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/public/ContactForm.integration.test.tsx` |
| Référence | F-PUB-01 |

## Préconditions
- Page publique `/contact` rendue.
- Formulaire de contact avec champs : nom, e-mail, téléphone, message, consentement RGPD.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('*/api/public/contact', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        ok: true,
        leadId: 'lead_new_001',
      },
      { status: 201 },
    );
  }),
];
```

## Action utilisateur

1. Saisir nom, e-mail valide, téléphone, message.
2. Cocher la case « J'accepte la politique de confidentialité ».
3. Cliquer "Envoyer".

## Assertions

- La requête `POST` envoie `consent_at: <iso timestamp>` (date du clic).
- Après `201`, un message de confirmation s'affiche : « Merci, nous vous recontacterons sous 24 h. »
- Le formulaire est réinitialisé.
- Côté serveur (validé en intégration backend) : un lead `type: 'contact'` est créé et un event `lead.created` est enqueue dans `webhook_deliveries`.
- Aucun appel direct à un consommateur webhook n'est fait depuis le client (le serveur enqueue, le cron dispatche).
- Le bouton "Envoyer" est désactivé pendant la requête.

## Edge cases couverts ailleurs

- Sans consentement → `scenario-public-no-consent.md`
- Rate limit → `scenario-public-rate-limit.md`
- Order → `scenario-public-order.md`
- Newsletter → `scenario-public-newsletter.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactForm } from './ContactForm';

it('soumet le formulaire contact avec consentement', async () => {
  const user = userEvent.setup();
  render(<ContactForm />);
  await user.type(screen.getByLabelText(/nom/i), 'Leïla Bennani');
  await user.type(screen.getByLabelText(/e-mail/i), 'leila@example.ma');
  await user.type(screen.getByLabelText(/téléphone/i), '+212612345678');
  await user.type(screen.getByLabelText(/message/i), 'Bonjour, intéressée par votre offre.');
  await user.click(screen.getByLabelText(/politique de confidentialité/i));
  await user.click(screen.getByRole('button', { name: /envoyer/i }));
  expect(await screen.findByText(/merci, nous vous recontacterons/i)).toBeInTheDocument();
});
```
