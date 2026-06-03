# Runbook — Pilotage de l'exécution de la batterie de tests coupons

> Ce runbook pilote l'exécution du `90-action-plan/`. Il est opérable par un humain ou un agent. Chaque section est une procédure reproductible.

## 0. Pré-requis environnement

```bash
cd apps/web
pnpm install                       # dépendances (msw, playwright, axe déjà au repo)
pnpm exec playwright install       # navigateurs (chromium, webkit) si absent
cp .env.example .env.local         # sans DATABASE_URL → memoryStore (tests rapides)
```

- **Sans `DATABASE_URL`** : tests Vitest tournent sur `memoryStore()` (rapide, déterministe). C'est le mode par défaut de la campagne.
- **Avec PGlite/Postgres in-process** (`__setTestDb`) : pour exercer le vrai SQL (migration, contraintes uniques) — Vague 1 uniquement.

## 1. Boucle de pilotage par vague

Pour chaque vague `Wn` de `phases.yaml` :

```
ÉTAPE 1 — PRÉPARER : lire phases.yaml[Wn] (produces/modifies/test_command/exit_gates)
ÉTAPE 2 — IMPLÉMENTER : créer/modifier les fichiers (TDD : test rouge → code → vert)
ÉTAPE 3 — EXÉCUTER : lancer test_command de la vague
ÉTAPE 4 — TRIAGE : pour chaque échec → triage-playbook.md → ticket EB-### maj
ÉTAPE 5 — CORRIGER : correction-loop.md (bonne couche)
ÉTAPE 6 — VÉRIFIER GATES : quality-gates.yaml ∩ phases.yaml[Wn].exit_gates
ÉTAPE 7 — STABILISER : re-run vague 3× → 0 flaky
ÉTAPE 8 — NON-RÉGRESSION : re-run vagues précédentes
ÉTAPE 9 — CLORE : execution-board.csv tickets → done ; passer à Wn+1
```

## 2. Commandes par vague (résumé ; détail dans commands.md)

```bash
# W0 — outillage
pnpm test src/test

# W1 — data & migration
pnpm exec drizzle-kit generate          # produit 0080_coupons.sql
pnpm test src/lib/db/queries/coupon

# W2 — moteur (couverture 100% exigée)
pnpm test src/lib/coupons --coverage

# W3 — prix & checkout (coeur, anti-422)
pnpm test src/lib/checkout src/lib/products
pnpm exec playwright test e2e/visitor-coupon.spec.ts

# W4 — admin
pnpm test src/app/api/admin/coupons src/app/admin/coupons
pnpm exec playwright test e2e/admin-coupon.spec.ts

# W5 — UI landing
pnpm test src/components/sections/CouponWelcomeNote
pnpm exec playwright test e2e/visitor-coupon.spec.ts --grep @charte

# W6 — E2E global multi-navigateurs
pnpm exec playwright test --project=chromium --project=webkit
```

## 3. Vérification des gates (manuelle ou scriptée)

| Gate | Comment vérifier |
|---|---|
| G-PRICE-PARITY | `playwright` visiteur : 0 réponse 422 `price_mismatch` ; `totalCents` réseau == prix affiché DOM |
| G-HOLDOUT-DETERMINISM | `vitest` : 10 000 tirages même `visitorKey` → 1 seul bucket ; cross-surface affichage==order |
| G-FALLBACK-LEGACY | désactiver coupon (fixture) → page rend 199 (promoPriceCents) puis 289 ; aucune exception |
| G-CHARTE | `playwright` : assert absence sélecteurs rouge/countdown/emoji ; snapshot visuel stable |
| G-RBAC | `vitest` contract : viewer→403 sur POST/PATCH/DELETE ; non-auth→redirect |
| G-IDEMPOTENCE | double POST order même clé → 1 order, 1 event converted |
| G-TRACKING-VALUE | dataLayer/`getKitLeadValue` == 199 ; jamais 289 comme value payée |
| G-A11Y | `axe-core` 0 violation critique/grave sur module + admin |
| G-I18N | rendu fr (MAD) et ar (درهم, RTL) |

## 4. Reporting

À la fin de chaque vague, produire (ou mettre à jour) :
- `execution-board.csv` (statut tickets).
- Un court compte-rendu : vague, tests passés/échoués, gates, flaky, décisions.

## 5. Critère GO/NO-GO release Phase 1

**GO** ssi : tous P0 verts, ≥95% P1, tous gates fonctionnels verts, 0 flaky (3 reruns), E2E visiteur+opérateur verts Chromium+WebKit, rollback validé.
**NO-GO** sinon → rouvrir la vague concernée.

## 6. Procédure de rollback produit (si incident en prod après déploiement)

1. Admin → `/admin/coupons` → passer `welcome_auto` en `paused`.
2. `revalidateTag('coupons')` (automatique à la mutation) → `/kit` retombe sur `promoPriceCents=19900` → 199 MAD.
3. Si moteur défaillant : remettre `promoPriceCents=19900` (déjà en seed) garantit 199 même coupon ignoré.
4. Vérifier : `/kit` affiche 199, commande passe sans 422, `getKitLeadValue`=199.
5. Post-mortem : ticket + test de non-régression.
