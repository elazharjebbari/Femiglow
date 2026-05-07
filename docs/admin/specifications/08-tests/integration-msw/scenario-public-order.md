# scenario-public-order

| Aspect | Valeur |
|---|---|
| Domaine | public |
| Composant | `OrderForm` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/public/OrderForm.integration.test.tsx` |
| Référence | F-PUB-02 |

## Préconditions
- Page publique `/commander` rendue.
- L'utilisateur a sélectionné un pack à 990 MAD.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('*/api/public/orders', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        ok: true,
        orderId: 'ord_new_001',
        leadId: 'lead_new_002',
      },
      { status: 201 },
    );
  }),
];
```

## Action utilisateur

1. Saisir nom, e-mail, téléphone, ville, adresse de livraison.
2. Confirmer le pack et la quantité (1 pack à 990 MAD).
3. Cocher le consentement RGPD.
4. Cliquer "Commander".

## Assertions

- Le body envoyé inclut : `lineItems`, `consentAt`, `shippingAddress`.
- Après `201`, redirection vers `/commande/confirmation?id=ord_new_001`.
- Côté serveur : 1 lead `type: 'order'` créé + 2 events enqueue (`lead.created`, `order.created`) dans `webhook_deliveries`.
- L'order est en status `pending_payment` (paiement séparé).
- Le bouton "Commander" est désactivé pendant la requête.
- Validation : si quantité <= 0 → erreur client, pas de requête.

## Edge cases couverts ailleurs

- Contact → `scenario-public-contact.md`
- Sans consentement → `scenario-public-no-consent.md`
- Rate limit → `scenario-public-rate-limit.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { OrderForm } from './OrderForm';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

it('soumet une commande et redirige vers la confirmation', async () => {
  const user = userEvent.setup();
  render(<OrderForm />);
  await user.type(screen.getByLabelText(/nom/i), 'Yassine Kaddouri');
  await user.type(screen.getByLabelText(/e-mail/i), 'y@example.ma');
  await user.type(screen.getByLabelText(/téléphone/i), '+212600000000');
  await user.type(screen.getByLabelText(/ville/i), 'Casablanca');
  await user.type(screen.getByLabelText(/adresse/i), '12 rue Z');
  await user.click(screen.getByLabelText(/politique/i));
  await user.click(screen.getByRole('button', { name: /commander/i }));
  await vi.waitFor(() =>
    expect(push).toHaveBeenCalledWith('/commande/confirmation?id=ord_new_001'),
  );
});
```
