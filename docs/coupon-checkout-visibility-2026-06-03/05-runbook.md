# 05 — Runbook (pilotage de l'exécution)

Commandes depuis `apps/web/`. Boucle par étape D1→D6 : implémenter → tester → vérifier → suite.

## Commandes
```bash
# D1 — récap ligne welcome
pnpm exec vitest run src/components/checkout/wizard/WizardCartRecap.welcome.test.tsx
# Non-régression récap
pnpm exec vitest run src/components/checkout/wizard/WizardCartRecap.coupon.test.tsx

# D6 — global
pnpm exec tsc --noEmit
pnpm exec vitest run src/components/checkout src/lib/coupons src/components/sections
pnpm exec eslint src/components/checkout/wizard/WizardCartRecap.tsx src/components/sections/KitCommanderSectionBound.tsx

# E2E
pnpm exec playwright test e2e/coupon-checkout.spec.ts --project=chromium
```

## Vérification preview (admin → wizard)
1. `preview_start` (port 3001). Login admin (bootstrap) puis :
2. **Actif** : `/kit`, ouvrir le wizard (scroll vers `kit-commander-section`) → la mention « geste d'accueil · Économie 90 MAD » apparaît dans le récap.
3. **Pause** (admin) : `POST /api/admin/coupons/<welcome>/status {status:'paused'}` → recharger `/kit` → mention **absente** du wizard ET de la page.
4. **Valeur −50** : `PATCH /api/admin/coupons/<welcome> {valueAmount:5000}` → « Économie 50 MAD », prix 239.
5. **Restaurer** : valeur 9000, status active.

## Gate GO/NO-GO
- 0 erreur TS · W1–W8 + non-régression verts · lint OK · `/kit` 200.
- Revue charte (06 playbook) : aucune dérive (rouge/sticker/countdown/`!`/emoji/`%`).
- Cohérence /kit ↔ wizard vérifiée en preview.

## Rollback
La feature est **additive et inerte par défaut** : ne pas passer `welcomeCoupon` (ou `active:false`) → récap strictement identique à l'existant. Aucun impact prix/commande. Retirer la prop suffit.
