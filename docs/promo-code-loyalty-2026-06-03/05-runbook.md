# 05 — Runbook (pilotage exécution)

Depuis apps/web. Boucle G1→G8 : implémenter → tester → vérifier → suite.

## Commandes
```bash
# G1 migration
pnpm db:generate --name loyalty_grant_activation   # 0082 (trim au DDL grants)
# G2/G3 logique
pnpm exec vitest run src/lib/coupons/delivery-delay.test.ts src/lib/db/queries/coupon-grant-repo.test.ts
# G5 UI
pnpm exec vitest run src/components/checkout/wizard/steps  src/components/checkout/LoyaltyCodeCard.test.tsx
# G6 admin
pnpm exec vitest run src/app/api/admin/coupons
# G8 global
pnpm exec tsc --noEmit
pnpm exec vitest run src/lib/coupons src/lib/db/queries src/components/checkout
pnpm exec playwright test e2e/loyalty-code.spec.ts --project=chromium
```

## Migration sans downtime
0082 = ALTER TABLE coupon_grants ADD COLUMN (nullable) + CREATE INDEX (partiel) → additif, non bloquant. Appliquer via `pnpm db:migrate-safe` ; fallback `node --env-file=.env scripts/_reconcile-migrations.mjs`.

## Vérification preview
1. Passer une commande de bout en bout → ThankYouStep affiche `FG-<MOT>-<NNNN>` + « utilisable à partir du <date> ».
2. Vérifier en base : `SELECT code, phone_e164, activates_at, expires_at, status FROM coupon_grants ORDER BY created_at DESC LIMIT 3;`
3. Saisir ce code AVANT activation au checkout → message « pas encore actif » (pas de 422).
4. Avancer l'horloge (ou seed activates_at passé) → code applique la réduction → status redeemed.
5. 2ᵉ commande même téléphone → même code (unicité).
6. /admin/coupons → onglet « Codes émis » → le code listé, téléphone masqué.

## Rollback
Champs additifs : retirer l'affichage (ThankYouStep) + cesser de passer activatesAt → comportement Phase 3 d'origine. Pour stopper l'émission : passer le template post_purchase en `paused` (admin).
