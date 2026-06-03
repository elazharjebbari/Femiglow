# 04 — Stratégie de test (Vitest · MSW · Playwright)

## Vitest (pur / intégration)
- `delivery-delay.test.ts` — `maxDeliveryDays` : « 24h »→1, « 24-48h »→2, « 48 à 72 h »→3, « 72h »→3, « 5 jours »→5, vide→3 (capitale)/4 (reste) ; `computeActivatesAt(order, eta)` = order + days + 1j.
- `coupon-grant-repo.test.ts` (étendu) — code mémorable `^FG-[A-Z]+-\d{4}$` ; unicité phone (2 émissions même phone → même grant) ; `validateGrant` not_yet_active (now < activatesAt) ; expired (now > expiresAt) ; `listGrants` filtre phone/statut ; `findActiveGrantByPhone`.
- `LoyaltyCodeCard.test.tsx` — code affiché, valeur terracotta, activation civile, bouton copier (clipboard mocké), charte (pas de % / ! / emoji / countdown).

## MSW
- ThankYouStep / admin grants : interception des réponses (code présent ; liste grants) ; états vide / erreur.

## Contract (route handlers)
- `order/route` : réponse 201 contient `loyaltyCode` + `loyaltyActivatesAt` ; idempotence phone (2 commandes même phone → même code).
- `api/admin/coupons/grants` : auth → 401 ; RBAC viewer read OK ; filtre phone/statut.

## Playwright (e2e)
- `loyalty-code.spec.ts` : parcours commande → ThankYouStep affiche un code `FG-…` + mention « utilisable à partir du … » ; pas de countdown/rouge ; (skip si template inactif).

## Gates
- tsc 0 ; tous P0 verts ; non-régression grants/redemption existante ; PII téléphone masquée en admin ; aucun 422 silencieux (not_yet_active renvoyé en amont).
