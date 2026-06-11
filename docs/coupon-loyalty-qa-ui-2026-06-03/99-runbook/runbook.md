# Runbook — exécution de la batterie QA UI coupon/fidélité

> Pilote l'exécution du `90-action-plan`. Tout depuis `apps/web/`. Suivre l'ordre des vagues ;
> ne pas passer une vague tant que sa **gate** (`00-overview/quality-gates.yaml`) n'est pas verte.

## 0. Pré-vol (une fois)

```bash
cd apps/web
pnpm install                 # si nécessaire
pnpm typecheck               # base saine avant d'ajouter des tests
node -v                      # 20.x attendu
```
- Vérifier que `src/test/msw/coupons-handlers.ts` existe (fondation W0).
- Pour l'E2E : `.env` avec `DATABASE_URL` (les specs F16/F17/F18 touchent une vraie DB de preview/CI).

## 1. Dérouler les vagues

Pour **chaque** feature de la vague, appliquer la **boucle de correction** (plan §3) :

```bash
cd apps/web
# 1) écrire le fichier de test (depuis NN-*/test-cases.csv)
# 2) run ciblé
pnpm test <chemin/du/fichier.test.ts>
# 3) si rouge → triage (voir triage-playbook.md)
# 4) vert → non-régression du périmètre
pnpm test src/lib/coupons src/components/admin/coupons src/components/sections src/components/checkout
# 5) anti-flaky composant : Vitest n'a PAS de --repeat-each (flag Playwright) →
#    boucle. Les tests sont déterministes (MSW reset/file, pas de Date.now).
for i in 1 2 3; do pnpm test <fichier> || break; done
```

### W0 — fondations ✅
```bash
pnpm test src/test/msw/coupons-handlers.smoke.test.ts   # doit être vert (5)
```

### W1 — contrats API
```bash
pnpm test src/app/api/coupons/redeem/route.test.ts
pnpm test "src/app/api/admin/coupons/[id]/status/route.test.ts"
pnpm test "src/app/api/admin/coupons/[id]/stats/route.test.ts"
pnpm test src/app/api/admin/coupons/grants/route.filters.test.ts
pnpm test src/app/api/coupons/rescue/route.test.ts
# gate
pnpm test -t "F05" && pnpm test -t "F06" && pnpm test -t "F07" && pnpm test -t "F14" && pnpm test -t "F15"
```

### W2 — composants admin
```bash
pnpm test src/components/admin/coupons/CouponsManager.create.test.tsx
pnpm test src/components/admin/coupons/CouponsManager.status.test.tsx
pnpm test src/components/admin/coupons/CouponsManager.stats.test.tsx
pnpm test src/components/admin/coupons/CouponsManager.grants.test.tsx
pnpm vitest run --repeat-each 3 src/components/admin/coupons
```

### W3 — composants client
```bash
pnpm test src/components/sections/InvitationCodeField.msw.test.tsx
pnpm test src/components/checkout/wizard/steps/AddressStep.coupon.test.tsx
pnpm test src/components/checkout/wizard/WizardCartRecap.credit.test.tsx
pnpm test src/components/checkout/wizard/steps/ThankYouStep.loyalty.test.tsx
pnpm test src/components/sections/CouponWelcomeNote.test.tsx
pnpm test src/lib/checkout/state/wizard-store.loyalty.test.ts
```

### W4 — intégration & règles métier
```bash
pnpm test src/lib/coupons/pricing-integration.test.ts
pnpm test src/lib/db/queries/coupon-grant-repo.activation.test.ts
```

### W5 — E2E (nécessite serveur + DB)
```bash
# Pré-requis F18 : seed déterministe (template post_purchase actif + grant pré-activé)
node --env-file=.env --import tsx scripts/seed-e2e-loyalty.ts

# lancer le serveur de preview (port 3000 ou PLAYWRIGHT_BASE_URL) si pas déjà up
# puis :
pnpm exec playwright test e2e/admin-coupons-loyalty.spec.ts --project=chromium
pnpm exec playwright test e2e/loyalty-issuance.spec.ts --project=chromium
pnpm exec playwright test e2e/loyalty-redemption.spec.ts --project=chromium
pnpm exec playwright test --grep @a11y --project=chromium
```

### W6 — durcissement
```bash
pnpm typecheck
pnpm lint
# anti-flaky global du périmètre (Vitest = boucle, pas --repeat-each)
for i in 1 2 3; do pnpm test src/components/admin/coupons src/components/sections/InvitationCodeField.msw.test.tsx src/components/checkout/wizard || break; done
pnpm exec playwright test --repeat-each=2 e2e/loyalty-issuance.spec.ts e2e/loyalty-redemption.spec.ts e2e/admin-coupons-loyalty.spec.ts
```
Puis mettre à jour `00-overview/traceability-matrix.csv` + `feature-inventory.csv` (statut=fait) et compléter `90-action-plan/decision-log.md`.

## 2. Préconditions & pièges (à connaître avant W5)

1. **Activation delay (F18, bloquant si ignoré).** Code émis ⇒ `not_yet_active`. La redemption exige
   `activatesAt` dans le passé. → `scripts/seed-e2e-loyalty.ts` pré-active un grant de test ; en
   dépannage manuel : `node --env-file=.env --import tsx scripts/_loyalty-activate-now.ts <CODE>`.
2. **Template post_purchase actif (F17).** L'upsert du seed **préserve** le statut existant : si le
   template a été mis en pause, le seed E2E doit le **réactiver** explicitement.
3. **Unicité téléphone (F17).** Un numéro réutilisé renvoie le **même** code (INV-IDEMP-PHONE). Pour
   observer un code frais, utiliser un téléphone unique par run (suffixe horodaté côté seed).
4. **`cd apps/web`** obligatoire (sinon « command not found »).
5. **MSW** : cycle par fichier, jamais global.
6. **Nettoyage E2E** : supprimer les grants de test après coup (`scripts/_loyalty-cleanup.ts`).

## 3. Sortie
Quand toutes les gates sont vertes : produire un court rapport (features couvertes, nb de fichiers,
bugs révélés) et le consigner dans `decision-log.md`.
