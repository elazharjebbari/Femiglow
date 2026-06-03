# F18 — E2E Redemption client (saisir code → crédit → commande réduite)

## Rôle & surface

Parcours bout-en-bout **Playwright** : la cliente **Yasmine** revient avec un code de
fidélité **déjà émis ET déjà activé**, le saisit dans la porte coupon de l'étape adresse, voit
une **ligne de crédit** apparaître dans le récap panier, et la commande se finalise avec un
**total réduit** du crédit — l'invariant anti-422 tenant (le prix affiché = le prix débité).

- **Surface** : `/kit` → wizard `lead → address` (disclosure coupon) → `thank_you`.
- **Composants** : `AddressStep` (`<details data-testid="wizard-coupon-field">` →
  `InvitationCodeField`), `WizardCartRecap` (ligne crédit + total), `wizard-store`
  (`setCoupon`/`creditCents`/`couponCode`).
- **Fichier cible** : `e2e/loyalty-redemption.spec.ts` (NOUVEAU).
- **Tag** : `@coupon-redemption` (famille `@coupon-*`).
- **Auth** : AUCUNE (visiteuse anonyme).

## 🔴 Précondition BLOQUANTE — délai d'activation (à lire avant exécution)

`InvitationCodeField` valide le code via `POST /api/coupons/redeem` → `validateGrant(code)`.
Un grant fraîchement émis (F17) est **`not_yet_active`** : son `activatesAt` est dans le
**futur** (`orderDate + maxDeliveryDays + 1j`). `validateGrant` renvoie alors
`{ valid:false, reason:'not_yet_active' }` → le champ affiche `invitation-code-ko`, AUCUN
crédit n'est appliqué.

**Conséquence** : on **NE PEUT PAS** enchaîner F17 (émission) puis F18 (redemption) dans le
même run sans manipuler le temps. F18 exige un grant **dont `activatesAt` est dans le passé**.

**Stratégie de seeding (précondition F18)** — trois options, par ordre de préférence :
1. **Ops script `_loyalty-activate-now.ts`** (existe déjà) :
   `cd apps/web && pnpm tsx scripts/_loyalty-activate-now.ts FG-XXX-NNNN` — force
   `activates_at = now - 24h` sur un grant existant. Le code passe alors `valid` immédiatement.
2. **Helper de seed dédié** (à créer si CI déterministe nécessaire) : insérer directement un
   `coupon_grant` lié au template `post_purchase`, pour un **téléphone connu**, avec
   `activatesAt = now - 1j` et `expiresAt = now + 59j` (statut `issued`). À placer à côté de
   `seed-coupons.ts` (ex. `scripts/seed-loyalty-grant.ts`).
3. **Émettre puis activer** : faire un parcours F17, capturer le `FG-…`, puis appeler
   `_loyalty-activate-now.ts <code>` avant le run F18.

Le code de référence stable utilisé par le live-check est **`FG-SAUGE-7212`** (défaut de
`_loyalty-activate-now.ts`). Documenter le code retenu dans `fixtures.json`.

**OPEN QUESTION pour le runbook** : pas de **test-hook HTTP** pour activer un grant à la volée
(seul un script CLI direct DB existe). Pour un CI 100% Playwright sans accès psql, il faut soit
exposer un endpoint de test gardé par un flag (`E2E_TEST_HOOKS=1`), soit lancer le script tsx
en `globalSetup` Playwright. **Décision à acter** dans `99-runbook/`.

Autres préconditions : template `post_purchase` actif (sinon le grant n'a pas de référence
valide) ; `INV-VALIDITY` — le code ne doit pas être expiré (`activatesAt + 60j > now`).

## Fonctionnement optimal (ce qui DOIT se passer)

1. **Lead.** Parcours standard jusqu'à l'étape adresse (cf. F17 §1).
2. **Ouvrir la porte coupon.** Étape `[data-testid="wizard-step-address"]`. La disclosure
   `<details data-testid="wizard-coupon-field">` est **repliée** par défaut. Cliquer le
   summary `[data-testid="wizard-coupon-summary"]` (« J'ai un code de fidélité ») → le
   `details` s'ouvre, révélant `[data-testid="invitation-code-field"]`.
3. **Saisir + valider.** Taper le code activé dans l'input `aria-label` du champ, cliquer
   « Appliquer ». `POST /api/coupons/redeem` → `{ valid:true, valueCents:2000 }`. Le champ
   passe à l'état valide : `[data-testid="invitation-code-ok"]` affiche « Crédit de 20 MAD
   appliqué — déduit au paiement. » + coche sauge. La callback `onValid` →
   `setCoupon(code, 2000)` → store `couponCode` + `creditCents=2000`.
4. **Ligne de crédit dans le récap.** Le `WizardCartRecap` (re-rendu avec
   `appliedCreditCents=2000`) affiche `[data-testid="wizard-credit-line"]` = « Crédit fidélité
   −20 MAD » (sauge) et `[data-testid="wizard-cart-recap-total"]` = total **réduit** de 20 MAD
   (ex. 199 → 179 MAD), plafonné à 0.
5. **Commander.** Clic `[data-testid="wizard-address-submit"]`. La mutation envoie
   `expectedTotalCents = totalCents − min(creditCents, totalCents)` et `couponCode`. Le serveur
   reprice, soustrait le **même** crédit via le grant → totaux coïncident, **aucun 422**. La
   commande aboutit à `[data-testid="wizard-step-thankyou"]`.

## Contrat I/O

| Geste | Appel | Réponse |
|---|---|---|
| Valider code | `POST /api/coupons/redeem` `{code}` | `{ valid:true, valueCents:2000 }` (activé) / `{ valid:false, reason }` |
| Commander | `POST /api/checkout/order` `{ expectedTotalCents:17900, couponCode:'FG-…' }` | 201 ; total = 199−20 = 179 MAD |

**INV-422** : `expectedTotalCents = totalCents − min(credit, totalCents)`. Mismatch ⇒
`PriceMismatchError` (422). Attendre : `page.waitForResponse(/api\/coupons\/redeem/)` puis
`page.waitForResponse((r) => r.url().includes('/api/checkout/order') && r.request().method()==='POST')`.

## Cas limites & non-happy-path

- **Code `not_yet_active`** (grant non activé) → `invitation-code-ko` « Code introuvable ou
  expiré. », pas de ligne crédit, total inchangé. C'est le **piège du délai d'activation** :
  documenter qu'un code F17 fraîchement émis tombe ici si non pré-activé.
- **Code `expired`** (`activatesAt + 60j < now`) → même `invitation-code-ko`. INV-VALIDITY.
- **Code `already_redeemed`** → `invitation-code-ko` (le grant a déjà servi).
- **Code introuvable** → `invitation-code-ko`.
- **< 3 caractères** → le bouton « Appliquer » reste `disabled` (`canSubmit` false), aucun appel.
- **Ré-édition après validation** (anti-stale) : modifier le code après un succès remet
  `status:idle` et appelle `onClear` → `clearCoupon()` → la ligne crédit disparaît, total
  revient à 199 ; il faut re-valider avant de commander.
- **Floor du crédit** : si crédit ≥ total, total plancher = 0 (jamais négatif) ;
  `expectedTotalCents=0`. (Hors scope du happy path 20 MAD < 199, mais à garder en tête.)
- **Compile-on-demand** : `test.setTimeout(90_000)`.

## Invariants couverts

- **INV-422** — `expectedTotalCents` = total après crédit (plancher 0) ; pas de
  `PriceMismatchError` au POST order.
- **INV-VALIDITY / INV-ACTIVATION** — `not_yet_active` et `expired` rejetés ; seul un grant
  activé non expiré crédite.
- **INV-NONCUMUL** — le crédit fidélité (manuel) est une ligne distincte du geste d'accueil
  (auto) ; ils coexistent sans collision sur le total.
- Lacune audit adressée : **E2E redemption client** (🔴 audit §3, « geste métier central »).

## Critères d'acceptation (observables)

- La disclosure `wizard-coupon-field` est `open=false` au départ, `open=true` après clic summary.
- Après validation : `invitation-code-ok` visible avec « Crédit de 20 MAD appliqué ».
- `wizard-credit-line` visible = « Crédit fidélité −20 MAD » ; `wizard-cart-recap-total`
  réduit de 20 MAD (ex. « 179 MAD »).
- Le POST `/api/checkout/order` répond **201** (pas 422) ; `wizard-step-thankyou` s'affiche.
- Avec un code `not_yet_active` : `invitation-code-ko` visible, total inchangé.

## Points à vérifier — tous points de vue

- **Backend** : `redeem` est une **prévisualisation** (ne consomme pas) ; la consommation réelle
  est au `createOrder` (autoritaire, mêmes centimes).
- **Frontend** : `onValid`→`setCoupon`, `onClear`→`clearCoupon` ; le store pilote
  `appliedCreditCents` du récap.
- **UI/UX/design** : crédit en sauge (succès), `tabular-nums`, « −20 MAD » insécable ; pas de
  rouge agressif sur l'état invalide (encre/55).
- **Data** : `valueCents` du grant = crédit appliqué = montant soustrait au serveur.
- **A11y** : `invitation-code-ko` est `role="alert"` ; disclosure clavier-navigable.
- **i18n** : variante AR — « رصيد 20 درهم … », « الرمز غير صالح أو منتهي. », `dir="rtl"`.
