# 03 — Plan de conception + plan de dev (vagues G1→G8)

Chaque vague = code + tests, validée avant la suivante.

## G1 — Données : migration 0082 (activates_at, phone_e164, index unicité phone)
- schema.ts : ajouter `activatesAt`, `phoneE164` à `couponGrants` + index unique partiel phone-actif + index phone. Générer 0082 (drizzle-kit) ; trim au DDL grants.
- Repo types (CouponGrantRow) suivent automatiquement.
- **Tests** : repo (issue avec phone/activatesAt ; unicité phone).

## G2 — Délai ville : parser ETA → activatesAt
- `lib/coupons/delivery-delay.ts` : `maxDeliveryDays(eta)`, `computeActivatesAt(orderDate, eta)`.
- **Tests (vitest)** : « 24h »→1, « 24-48h »→2, « 48 à 72 h »→3, « 72h »→3, vide/null→défaut ; activatesAt = order + days + 1.

## G3 — Code mémorable + unicité phone (repo)
- `generateMemorableGrantCode()` (FG-<MOT>-<NNNN>) + retry collision.
- `issueGrant` : param `phoneE164`, `activatesAt` ; dédup par phone (`issued`) → réutilise ; `expiresAt = activatesAt + 60j`.
- `validateGrant` : motif `not_yet_active` + `activatesAt` exposé.
- `listGrants(filter)` (admin) + `findActiveGrantByPhone`.
- **Tests** : format code, unicité phone (2 commandes même phone → 1 code), not_yet_active, listGrants filtre.

## G4 — Route order : activation ville + phone + renvoi du code
- Calcule `activatesAt` (ETA ville du lead), passe `phoneE164` + `activatesAt`, renvoie `loyaltyCode/loyaltyActivatesAt/loyaltyValueCents` dans la réponse 201.
- **Tests** : contract (réponse contient le code ; idempotence phone).

## G5 — ThankYouStep : afficher le code (médaillon + copier + activation)
- Composant `LoyaltyCodeCard` (présentational) + intégration ThankYouStep (lit le résultat order).
- **Tests (vitest/RTL)** : code affiché, valeur terracotta, activation civile, bouton copier (clipboard mocké), charte (pas de %/!/emoji/countdown).

## G6 — Admin « Codes émis »
- Route `GET /api/admin/coupons/grants` (auth + RBAC) ; section dans `/admin/coupons` (table + filtres phone/statut, téléphone masqué).
- **Tests** : contract (auth/RBAC/filtre) + rendu liste.

## G7 — E2E
- `e2e/loyalty-code.spec.ts` : commande → ThankYouStep affiche un code FG-…; (robuste : skip si template inactif).

## G8 — Vérif & durcissement
- tsc 0 · suites coupons/checkout/sections vertes · lint 0 · migration validée · vérif preview (commande → code affiché ; activation future ; not_yet_active au redeem anticipé).

## Risques & parades
| Risque | Parade |
|---|---|
| Activation mal calculée (ETA non parsable) | défaut sûr 3/4 j + tests parser exhaustifs |
| Doublons par téléphone | index unique partiel + dédup à l'émission |
| 422 si redeem avant activation | `not_yet_active` renvoyé tôt (validation) → message UI clair, jamais 422 silencieux |
| PII téléphone | masquage admin + pas de log clair |
| Non-régression grants existants | champs additifs nullables ; expiresAt recalc seulement à l'émission future |
