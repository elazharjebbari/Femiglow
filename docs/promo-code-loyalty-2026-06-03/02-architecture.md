# 02 — Architecture (data · backend · frontend)

## 1. Modèle de données — `coupon_grants` (migration 0082, additive)
Ajouts :
- `activates_at timestamptz` — date d'activation (commande + délai ville). `validateGrant` refuse avant.
- `phone_e164 text` — téléphone bénéficiaire (unicité + lien client).
Index :
- `coupon_grants_phone_active_unique` — UNIQUE `(phone_e164)` WHERE `status='issued' AND phone_e164 IS NOT NULL` → **un seul code actif par téléphone**.
- `coupon_grants_phone_idx` — `(phone_e164)` (recherche admin).
`expires_at` : désormais calculé = `activates_at + 60 j` (au lieu de émission + 60 j).

## 2. Backend
- **Délai ville** : `maxDeliveryDays(deliveryEta: string): number` (lib/coupons/delivery-delay.ts) — parse l'ETA (« 24h », « 48 à 72 h », « 24-48h ») → jours max (`ceil(maxHours/24)`), défaut 3 (capitale) / 4 (reste) si non parsable. `computeActivatesAt(orderDate, deliveryEta)` = orderDate + maxDays + 1 j.
- **Code mémorable** : `generateMemorableGrantCode()` (coupon-grant-repo) → `FG-<MOT>-<NNNN>`. Retry sur collision (unique index).
- **Émission** : `issueGrant({ ..., phoneE164, activatesAt, expiresAt })`. Idempotence renforcée : si un grant `issued` existe déjà pour `phoneE164`, le **réutiliser** (pas de doublon) ; sinon par `sourceOrderId` (existant). `expiresAt = activatesAt + 60 j`.
- **Validation** : `validateGrant` ajoute `not_yet_active` (`now < activates_at`) ; renvoie `activatesAt` pour l'UI.
- **Route order** : calcule `activatesAt` depuis l'ETA ville du lead, passe `phoneE164` + `activatesAt`, **renvoie le code** (`loyaltyCode`, `activatesAt`, `valueCents`) dans la réponse 201.
- **Admin** : `GET /api/admin/coupons/grants?phone=&status=` → liste paginée (auth + RBAC `coupons:read`). Repo `listGrants(filter)`.

## 3. Frontend
- **ThankYouStep** : reçoit le code (via la réponse order, stockée au store `orderResult` ou re-fetch léger) → affiche le médaillon code + activation + valeur + bouton copier (`navigator.clipboard`). Fallback : si pas de code (template inactif) → rien.
- **Admin** : section « Codes émis » dans `/admin/coupons` (table + filtres), client component appelant la route grants.

## 4. Flux
```
Commande créée (route order)
  → ville du lead → deliveryEta → maxDeliveryDays → activatesAt = order + délai + 1j
  → issueGrant(phoneE164, code mémorable, activatesAt, expiresAt=activatesAt+60j)   [1/phone, idempotent]
  → réponse 201 { orderId, loyaltyCode, loyaltyActivatesAt, loyaltyValueCents }
ThankYouStep affiche le code « gardez-le · utilisable à partir du JJ »
... plus tard ...
Nouvelle commande : couponCode saisi → validateGrant (not_yet_active si avant activation)
  → repricing applique la réduction → redeemGrant (status=redeemed)
```

## 5. Invariants / non-régression
- Additif (0082) → **no downtime** ; comportement inchangé si template post_purchase inactif.
- `validateGrant`/`redeemGrant` rétro-compatibles (nouveau motif `not_yet_active`, le reste inchangé).
- Idempotence par phone ET par order → pas de doublon même en rejeu.
- PII : `phone_e164` stocké pour l'unicité ; **affichage admin masqué** (06…**…78), jamais loggé en clair.
