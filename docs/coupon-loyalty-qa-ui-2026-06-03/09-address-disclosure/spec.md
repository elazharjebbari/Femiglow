# F09 — AddressStep : disclosure « J'ai un code de fidélité » (porte repliée + câblage store)

## Rôle & surface
Au step 2 du wizard (adresse), proposer une **porte discrète** repliée par défaut donnant accès au
champ de crédit fidélité (`InvitationCodeField`). Zéro friction pour qui n'a pas de code ; reprise
fluide pour qui revient avec un code déjà saisi. Le code validé est câblé au store
(`setCoupon`/`clearCoupon`) qui pilote le total affiché (plancher 0).
Surface : `<details data-testid="wizard-coupon-field">` + `<summary data-testid="wizard-coupon-summary">`
dans `apps/web/src/components/checkout/wizard/steps/AddressStep.tsx`.
Fichier de test : `src/components/checkout/wizard/steps/AddressStep.coupon.test.tsx`.

> **Setup réaliste (à documenter dans le test).** `AddressStep` est un composant client qui lit le
> store Zustand et appelle `useAddressMutation` (POST order) + `useShippingConfig` +
> `useWizardTranslation` + `CityAutocomplete` (qui fetch `/api/delivery-cities/search`). Le test doit :
> 1. **semer le store** via `useWizardStore.setState({ formContext, cartSnapshot, couponCode? })` avant
>    render (et `reset()` en `afterEach` pour l'isolation) ;
> 2. **mocker `useAddressMutation`** (et au besoin `useShippingConfig`/`CityAutocomplete`) pour ne PAS
>    déclencher de vraies mutations — le focus de F09 est la disclosure + le câblage `setCoupon` ;
> 3. utiliser **MSW `redeemHandlers`** pour la validation interne du champ (réutilise F08) ;
> 4. asserter directement sur le store (`useWizardStore.getState().couponCode/creditCents`) plutôt
>    que sur le total (le total vit dans `WizardCartRecap`, couvert par F10).

## Fonctionnement optimal (ce qui DOIT se passer)
1. **Repliée par défaut** : `couponDisclosureOpen` est initialisé à `!!couponCode`. Sans code en store
   → `<details>` **fermée** (`open === false`), seul le `<summary>` « J'ai un code de fidélité » (FR) /
   « لدي رمز وفاء » (AR) est visible. Le `InvitationCodeField` est dans le DOM mais le contenu est replié.
2. **Ouverte d'office en reprise** : si `couponCode` est déjà présent en store (refresh / retour) →
   `open === true`, le champ pré-rempli (`initialCode = couponCode`) est visible.
3. **Toggle** : clic sur le summary → `onToggle` met `couponDisclosureOpen` au reflet de
   `e.currentTarget.open` ; le chevron sauge pivote (`rotate-90` quand ouvert).
4. **Câblage validation** : `onValid(code, cents)` → `setCoupon(code, cents)` (store normalise
   upper/trim, clamp ≥0). `onClear()` → `clearCoupon()` (couponCode null, creditCents 0).
5. **Effet sur le total (INV-422)** : le total transmis à la commande est `total − min(credit, total)`
   (plancher 0). Le `expectedTotalCents` envoyé au POST order doit refléter ce total après crédit ;
   un mismatch déclenche `PriceMismatchError`. (Le calcul d'affichage est dans `WizardCartRecap` /
   `WizardCartRecap.credit.test.tsx` — F10 ; ici on verrouille la **source** du crédit dans le store.)

## Contrat I/O
- **Store lu** : `couponCode`, `formContext.language` (→ `isArabic`), `cartSnapshot`.
- **Actions** : `setCoupon(code, creditCents)`, `clearCoupon()`.
- **InvitationCodeField props** : `isArabic`, `initialCode={couponCode ?? ''}`, `onValid`, `onClear`.
- **Endpoint indirect** : le champ appelle `POST /api/coupons/redeem` (via MSW `redeemHandlers`).
- **Pas de filtre / pas de champ supplémentaire** rendu côté coupon ; une seule disclosure.

## Cas limites & non-happy-path
- **Sans couponCode** → `<details>` non ouverte au montage (`open` falsy) — non-régression « zéro
  friction ».
- **Avec couponCode** (reprise) → ouverte d'office, `InvitationCodeField` reçoit `initialCode`.
- **Toggle aller-retour** : ouvrir puis fermer → `couponDisclosureOpen` suit l'état natif du `<details>`.
- **onValid** d'un code valide → store reflète `couponCode = UPPER` et `creditCents = valueCents`.
- **onClear** (ré-édition dans le champ) → store remis à `null` / `0`.
- **Crédit ≥ total / plancher** (INV-422) : oracle calculé `expectedTotalCents = total −
  min(credit, total)` ≥ 0 (ex. total 19900, credit 2000 → 17900 ; credit 25000 → 0).
- **AR** : summary « لدي رمز وفاء » ; le champ interne en RTL.
- **Charte** : summary discret (souligné chuchoté), chevron sauge ; aucun `%`/`!`/emoji.

## Invariants couverts
- **INV-422** : `expectedTotalCents` = prix d'affichage après crédit (plancher 0). Le crédit appliqué
  vient du store, alimenté ici. Oracle de cohérence : `total − min(credit, total)` jamais négatif.
- **Anti-stale** (hérité de F08) : `onClear` câblé à `clearCoupon` empêche un crédit obsolète d'être
  transmis.
- Lacune d'audit : « AddressStep disclosure » non testée.

## Critères d'acceptation (observables)
- Store sans code → `wizard-coupon-field` rendu avec `open` falsy ; summary contient « J'ai un code de
  fidélité ».
- Store avec `couponCode='FG-SAUGE-7212'` → `wizard-coupon-field` `open === true` ; l'input du champ
  porte la valeur `FG-SAUGE-7212`.
- Après validation d'un code via le champ → `useWizardStore.getState().couponCode === 'FG-SAUGE-7212'`
  et `creditCents === 2000`.
- Après ré-édition (onClear) → `couponCode === null` et `creditCents === 0`.
- INV-422 (test pur dérivé) : pour total 19900 + credit 2000 → `expectedTotalCents === 17900` ; pour
  credit 25000 → `0`.
- AR : summary contient « لدي رمز وفاء ».

## Points à vérifier — tous points de vue
- Backend : POST order reçoit `expectedTotalCents` après crédit (rejet si mismatch).
- Frontend : init `open=!!couponCode` ; `onToggle` sync ; câblage onValid/onClear → store.
- UI/UX/design : porte repliée par défaut (anti-friction), chevron sauge pivotant, summary chuchoté.
- Data : store normalise (upper/trim, clamp). Crédit jamais négatif.
- A11y : `<summary>` focusable/cliquable ; champ labellisé via `InvitationCodeField`.
- i18n : summary FR « J'ai un code de fidélité » / AR « لدي رمز وفاء ».
