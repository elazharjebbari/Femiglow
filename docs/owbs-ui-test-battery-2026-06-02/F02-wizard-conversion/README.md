# F02 — Wizard : conversion (address → payment(cod) → order) + garantie flush

**Surface :** `AddressStep` (`wizard-step-address`, `wizard-address-submit`,
`wizard-address-error`), `useAddressMutation`, `POST /api/checkout/order`,
`lead-sync-queue.flush()`. **Public :** acheteuse. **Particularité :** le wizard /kit
est en **2 étapes** — l'étape address **est la conversion** (elle enchaîne
patchAddress + patchPayment(cod) + createOrder), donc elle reste **synchrone**.

## 1. Fonctionnement optimal

1. À l'arrivée sur address, le lead a (peut-être) été créé en **tâche de fond** (F01).
2. Au submit address, **flag ON** : on **`await getLeadSyncQueue().flush()`** d'abord
   → garantit que le lead est persisté côté serveur **avant** la conversion.
3. Puis : `patchAddress` → `patchPayment('cod')` → `createOrder({leadId, snapshot complet})`
   (tous **awaités**, c'est la conversion). Le `createOrder` embarque items + total →
   fiable même si une écriture de fond a été lente.
4. Succès → `setOrderId` + tracking `purchase` (valorisé) → `goToStep('thank_you')`.
5. Effets durables (webhook order.created) **enqueués** dans `lead_event_outbox` (flag ON) → worker.

## 2. Points à vérifier (tous angles)

### UI/UX
- L'étape address montre un état **submitting** pendant la conversion (c'est légitime ici).
- Une erreur (stock/price/réseau) affiche `wizard-address-error` **sans** faire avancer vers thank-you.
- Pas de double-commande au double-tap.

### Frontend
- En flag ON, `flush()` est **awaité** avant `patchAddress` (ordre).
- En flag OFF, pas de flush (legacy) ; comportement identique à l'actuel.

### Backend / Data
- `createOrder` réussit **même si** la création lead était en file (flush a réconcilié) ; sinon erreur claire.
- Idempotence `order_create` : double appel ⇒ **une** commande.
- Une row `lead_event_outbox type=order_webhook dedupeKey=orderId` est créée (flag ON) ; legacy ⇒ `void dispatchOrderWebhook`.
- `chat_lead.purchased_at` posé ; scanner d'abandon ne relance plus.

### Tracking
- `purchase` émis avec `transaction_id`, `value`, `items` (valeur préservée).

### a11y
- Erreur annoncée (`role=alert` / aria-live) ; focus géré.

## 3. Oracle principal
> Le parcours complet remplir→adresse→commander mène à `wizard-step-thankyou`
> avec **une** commande ; un double-tap ne crée **jamais** une 2ᵉ commande ; une
> erreur réseau garde l'utilisatrice sur address avec un message visible.

## 4. Plans : [`scenarios.csv`](scenarios.csv) · [`test-plan.md`](test-plan.md) · [`business-scenarios.md`](business-scenarios.md)
