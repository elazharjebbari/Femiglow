# F02 — Plan de tests concret

> Cibles : `useAddressMutation` (étendre `use-wizard-mutations.test.tsx`),
> `e2e/owbs-ui-wizard-conversion.spec.ts`.

## A. RTL (mocks wizardClient + queue)
- **F02-S06** ordre flush : mock `getLeadSyncQueue().flush` + `wizardClient.patchAddress` ; flag ON ; `execute(address)` → asserter `flush` appelé **avant** `patchAddress` (via `mock.invocationCallOrder`).
- **F02-S13** flag OFF : `flush` **non** appelé.
- **F02-S22** a11y erreur : forcer une erreur (mock `createOrder` rejette) → `role="alert"` rendu + `expectNoAxeViolations`.
- **F02-S20** thank-you opt-in : rendre `ThankYouStep`, soumettre email → `wizard-email-confirmation-success`.

## B. MSW
- **F02-S10/S11** : `server.use(orderNetworkError | order500)` → l'UI affiche `wizard-address-error`, reste sur address.
- **F02-S03/S04** : `orderStockOut`(409) / `orderPriceMismatch`(422) → message spécifique.

## C. Intégration (pglite/route)
- **F02-S07** : conversion avec lead inexistant au préalable → après `flush` (simulé) la row existe → order créé. (ou : order route + upsert).
- **F02-S08** : double `order_create` même Idempotency-Key → 1 commande.
- **F02-S14/S15** : flag ON → `lead_event_outbox` contient `order_webhook` (dedupe orderId) ; flag OFF → pas d'enqueue.

## D. Playwright (build flag-ON)
```ts
test('F02-S02 double-tap commander -> une seule commande', async ({page}) => {
  await openWizard(page); await fillLead(page); await page.getByTestId('wizard-lead-submit').click();
  await fillAddress(page);
  const btn = page.getByTestId('wizard-address-submit');
  await Promise.all([btn.click(), btn.click().catch(()=>{})]);
  await expect(page.getByTestId('wizard-step-thankyou')).toBeVisible();
  // oracle: via spy réseau, un seul POST /api/checkout/order abouti
});
```
- **F02-S01** nominal → thank_you.
- **F02-S03/S04** : `page.route('**/api/checkout/order', fulfill 409/422)` → `wizard-address-error` visible.
- **F02-S05** : `/api/checkout/lead` bridé 6s, avancer vite à address, commander → la conversion attend le flush puis aboutit (oracle : thank_you, pas d'erreur « lead introuvable »).
- **F02-S12** retry après erreur.

## E. Étapes (test à chaque étape)
1. Ordre flush (S06) + parité OFF (S13) RTL → vert.
2. Erreurs UI (S03/S04/S10/S11/S22) MSW/RTL → vert.
3. Idempotence conversion (S07/S08/S14) intégration → vert.
4. Playwright nominal + double-tap + flush-race + erreurs (S01/S02/S05/S03) → vert.
5. Non-régression `use-wizard-mutations` (6/6).
