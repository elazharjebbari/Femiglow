# Plan d'action — Câblage frontend du crédit de fidélité (Phase 3, dernier centimètre)

> Objectif : permettre au visiteur de saisir son **code de crédit fidélité** dans le tunnel `/kit`, voir le **total ajusté**, et que la commande l'**applique et le consomme** côté serveur. Le backend est déjà prêt (route commande accepte `couponCode`, repricing applique + `redeemGrant`, endpoint `/api/coupons/redeem`).

## Invariant maître (à ne jamais casser)

**`expectedTotalCents` envoyé par le client = `cartSnapshot.totalCents − créditAppliqué`.** Le serveur reprice `welcome → effectif` puis soustrait `min(grant.valueCents, total)` et compare à `expectedTotalCents` (sinon `PriceMismatchError` → 422). Le crédit affiché provient de `/api/coupons/redeem` = **même source** que le grant serveur → les deux montants coïncident. Cap identique des deux côtés : `min(crédit, total)`.

**Anti-stale** : si le visiteur modifie le code après l'avoir validé, on **réinitialise le crédit à 0** (re-validation requise). Conséquence d'un crédit périmé/erroné : au pire un **422 (échec sûr, jamais une sur-remise)**.

## Décisions

- `couponCode` (string|null) **persisté** dans le store (reprise après refresh) ; `creditCents` (number) **non persisté** (re-validé à l'usage).
- `cart-snapshot-builder.ts` reste **inchangé et pur** (snapshot.totalCents = plein tarif). L'ajustement crédit vit dans le store + l'affichage + le payload — pas dans le snapshot.
- Champ de saisie placé dans **AddressStep** (avant soumission, sous le récap). On **réutilise `InvitationCodeField`** (déjà testé) avec callbacks `onValid`/`onClear` → écrit dans le store.

## Étapes

### S1 — Store : `couponCode` + `creditCents` + actions
Fichier : `apps/web/src/lib/checkout/state/wizard-store.ts`
- Ajouter au state : `couponCode: string | null` (def `null`), `creditCents: number` (def `0`).
- Actions : `setCoupon(code: string, creditCents: number)` ; `clearCoupon()` (remet `null`/`0`).
- `partialize` : persister `couponCode` uniquement (pas `creditCents`).
- **Tests (vitest)** : `wizard-store.test.ts` — setCoupon stocke code+credit ; clearCoupon réinitialise ; creditCents absent du payload persisté (partialize).

### S2 — `InvitationCodeField` : callback `onClear` + reset à l'édition
Fichier : `apps/web/src/components/sections/InvitationCodeField.tsx`
- Ajouter prop `onClear?()` ; appeler `onClear()` quand l'input change après une validation (statut repasse `idle`) et quand le champ est vidé.
- **Tests (vitest)** : `InvitationCodeField.test.tsx` — éditer après validation → `onClear` appelé (anti-stale).

### S3 — AddressStep : champ branché au store
Fichier : `apps/web/src/components/checkout/wizard/steps/AddressStep.tsx`
- Insérer `<InvitationCodeField onValid={(code,cents)=>setCoupon(code,cents)} onClear={clearCoupon} />` (depuis le store) sous le bloc ville / avant soumission. `data-testid="wizard-coupon-field"`.
- Pré-remplir depuis `store.couponCode` (reprise).
- **Tests (intégration MSW)** : `AddressStep.test.tsx` — saisir code valide (MSW `/api/coupons/redeem` → 2000) → store.creditCents=2000 ; code invalide → creditCents=0.

### S4 — WizardCartRecap : total ajusté + ligne crédit
Fichiers : `apps/web/src/components/checkout/wizard/WizardCartRecap.tsx` (+ passage prop depuis `WizardShell.tsx`)
- Prop `appliedCreditCents?: number` (depuis `store.creditCents`).
- Total affiché = `totalCents − min(appliedCreditCents, totalCents)`. Ligne « Crédit fidélité −X MAD » (charte, `data-testid="wizard-credit-line"`) si `>0`.
- **Tests (intégration)** : `WizardCartRecap.test.tsx` — credit 2000 sur 19900 → total affiché « 179 » + ligne crédit visible ; credit 0 → inchangé (non-régression).

### S5 — Soumission : `expectedTotalCents` ajusté + `couponCode` (CŒUR anti-422)
Fichier : `apps/web/src/lib/checkout/state/use-wizard-mutations.ts` (~L467-483)
- Lire `couponCode` + `creditCents` du store.
- `expectedTotalCents = cartSnapshot.totalCents − Math.min(creditCents, cartSnapshot.totalCents)`.
- Ajouter `couponCode: couponCode ?? undefined` au payload `createOrder`. Mettre à jour les deps du callback.
- **Tests (intégration MSW)** : `use-wizard-mutations.test.tsx` — avec crédit 2000 : le mock `createOrder` reçoit `couponCode` + `expectedTotalCents = total−2000` ; sans crédit : payload inchangé (non-régression) ; crédit > total → expectedTotalCents=0.

### S6 — E2E Playwright (parcours visiteur)
Fichier : `apps/web/e2e/coupon-credit.spec.ts`
- Seed/route : MSW non dispo en E2E → s'appuyer sur un grant seedé via API admin/preseed, OU tester le chemin invalide (code bidon → pas de réduction, total inchangé, pas de 422) qui ne dépend pas d'un grant valide.
- Cas P0 : saisir un code invalide → message sobre, total inchangé, commande passe sans 422. Cas (si grant dispo) : code valide → total ajusté → commande acceptée.
- Tag `@coupon-credit`.

### S7 — Vérification & durcissement
- `tsc --noEmit` = 0 erreur ; suite coupons + wizard verte ; non-régression `cart-snapshot` (14) + `wizard-kit` e2e.
- Vérif live : seed un grant, ouvrir `/kit`, saisir le code → total ajusté ; commande → 201, grant `redeemed`, pas de 422.

## Fichiers touchés (récap)
- `wizard-store.ts`, `InvitationCodeField.tsx`, `AddressStep.tsx`, `WizardCartRecap.tsx`, `WizardShell.tsx`, `use-wizard-mutations.ts` (+ tests associés + `e2e/coupon-credit.spec.ts`).
- **Non touchés** : `cart-snapshot-builder.ts` (pur), schéma order (déjà `couponCode`), backend (déjà prêt).

## Risques & parades
| Risque | Parade |
|---|---|
| 422 (total client ≠ serveur) | `expectedTotalCents = total − min(credit,total)` strictement ; crédit issu de la même source (endpoint→grant) ; tests S5. |
| Crédit périmé après édition | `onClear` reset `creditCents=0` ; re-validation obligatoire (S2). |
| Régression total sans crédit | `appliedCreditCents` défaut 0 → comportement identique ; tests non-régression S4/S5. |
| Persistance d'un crédit obsolète | `creditCents` non persisté ; seul `couponCode` repris, re-validé à l'usage. |

---

## Statut d'exécution (2026-06-03)

| Étape | Statut | Preuve |
|---|---|---|
| S1 store couponCode/creditCents | ✅ | wizard-store.coupon.test.ts (4) |
| S2 InvitationCodeField onClear | ✅ | InvitationCodeField.test.tsx (anti-stale) |
| S3 AddressStep champ câblé | ✅ | data-testid wizard-coupon-field |
| S4 WizardCartRecap total ajusté | ✅ | WizardCartRecap.coupon.test.tsx (3) |
| S5 expectedTotalCents ajusté + couponCode | ✅ | use-wizard-mutations.test.tsx S5-1/2/3 (anti-422) |
| S6 E2E coupon-credit.spec.ts | ✅ écrit | e2e/coupon-credit.spec.ts (CI) |
| S7 typecheck + régression | ✅ | tsc 0 erreur · 955 tests verts (checkout+coupons+sections) · lint 0 erreur |

Invariant G-PRICE-PARITY préservé : `expectedTotalCents = total − min(credit,total)` côté client == repricing serveur. Crédit issu de /api/coupons/redeem (même grant que le serveur).
