# F13 — wizard-store : coupon / loyalty (normalisation, clamp, persistance)

## Rôle & surface
Le store Zustand du wizard détient l'état coupon/fidélité qui pilote l'affichage du crédit et la
remise du code de fidélité. Cette feature verrouille les **actions** (`setCoupon`, `clearCoupon`,
`setLoyalty`), leur **normalisation** (upper/trim, clamp ≥0) et la **politique de persistance**
(`partialize` : persiste `couponCode` + `loyalty` mais **PAS** `creditCents`).
Fichier cible : `apps/web/src/lib/checkout/state/wizard-store.ts`.
Fichier de test : `src/lib/checkout/state/wizard-store.loyalty.test.ts`.

> **Extension, pas duplication.** `wizard-store.coupon.test.ts` couvre déjà U001 (défauts),
> U002 (setCoupon upper/trim + crédit), U003 (clamp négatif → 0), U004 (clearCoupon). Ce dossier
> **ne rejoue pas** ces 4 cas : il ajoute `setLoyalty`, l'arrondi `Math.round` du crédit, et surtout
> la **vérification du contrat `partialize`** (ce qui est / n'est pas persisté sous la clé
> `femiglow.wizard.v1`), angle non couvert.

## Setup réaliste (à documenter dans le test)
Deux approches possibles :
1. **Store nu** : tester `wizardStoreCreator` isolé (exporté) via un `create(wizardStoreCreator)` sans
   middleware persist — idéal pour les actions/normalisation.
2. **Store persisté** : importer `useWizardStore`, agir, puis lire le storage. Comme le persist utilise
   `safeStorage() ?? memoryStorage`, en jsdom c'est `localStorage`. Pour vérifier `partialize`, lire
   `JSON.parse(localStorage.getItem('femiglow.wizard.v1')).state` après une action.
Dans les deux cas : `reset()` / `localStorage.clear()` en `afterEach`.

## Fonctionnement optimal (ce qui DOIT se passer)
- **Défauts** : `couponCode = null`, `creditCents = 0`, `loyalty = null`.
- **`setCoupon(code, creditCents)`** : `couponCode = code.trim().toUpperCase()` ;
  `creditCents = Math.max(0, Math.round(creditCents))` (clamp ≥0 ET arrondi entier).
- **`clearCoupon()`** : `couponCode = null`, `creditCents = 0`.
- **`setLoyalty(loyalty)`** : pose tel quel l'objet `{ code, valueCents, activatesAt }` (ou null).
- **Persistance** (`PERSIST_KEY = 'femiglow.wizard.v1'`, `PERSIST_VERSION = 3`) : `partialize` persiste
  `leadId, orderId, formContext, cartSnapshot, currentStep, leadDraft, addressDraft, paymentDraft,
  couponCode, loyalty, resumeBannerDismissed` — et **EXCLUT** `creditCents` (re-validé à l'usage, le
  serveur reste autoritaire), `hydrated`, et les champs tracking éphémères.

## Contrat I/O
- **Actions** : `setCoupon(code: string, creditCents: number)`, `clearCoupon()`,
  `setLoyalty(loyalty | null)`.
- **State lu** : `couponCode`, `creditCents`, `loyalty`.
- **Storage** : clé `femiglow.wizard.v1`, version 3 ; format `{ state: {...}, version: 3 }`.

## Cas limites & non-happy-path
- **Normalisation upper/trim** : `setCoupon('  fg-sauge-7212  ', …)` → `couponCode = 'FG-SAUGE-7212'`.
- **Clamp négatif** : `setCoupon('X', -100)` → `creditCents = 0`.
- **Arrondi** : `setCoupon('X', 1999.6)` → `creditCents = 2000` (`Math.round`).
- **setLoyalty avec code** → `loyalty.code` lisible ; **setLoyalty(null)** → `loyalty = null`.
- **Persistance couponCode** : après `setCoupon`, le storage contient `couponCode` mais **pas**
  `creditCents`.
- **Persistance loyalty** : après `setLoyalty`, le storage contient `loyalty`.
- **creditCents jamais persisté** : même après `setCoupon('X', 2000)`, `state.creditCents` est absent
  du JSON storage.
- **clearCoupon après setCoupon** → storage `couponCode` redevient null.

## Invariants couverts
- **Anti-stale / autorité serveur** : `creditCents` non persisté ⇒ après refresh, le crédit doit être
  re-validé via `/api/coupons/redeem` avant d'être réappliqué (le store ne réhydrate qu'un `couponCode`,
  pas un montant). Support direct de **INV-422**.
- Normalisation déterministe du code (upper/trim) → cohérence avec le lookup backend.

## Critères d'acceptation (observables)
- Défauts : `getState()` → `couponCode === null`, `creditCents === 0`, `loyalty === null`.
- `setCoupon('  fg-sauge-7212  ', 2000)` → `couponCode === 'FG-SAUGE-7212'`, `creditCents === 2000`.
- `setCoupon('X', -100)` → `creditCents === 0`.
- `setCoupon('X', 1999.6)` → `creditCents === 2000`.
- `setLoyalty({code,valueCents,activatesAt})` → `getState().loyalty.code` correct ;
  `setLoyalty(null)` → `loyalty === null`.
- Après `setCoupon`, `JSON.parse(localStorage['femiglow.wizard.v1']).state.couponCode` présent ET
  `.creditCents === undefined`.
- Après `setLoyalty`, `.state.loyalty` présent.
- `clearCoupon` → `.state.couponCode === null`.

## Points à vérifier — tous points de vue
- Backend : le serveur reste autoritaire sur le crédit (d'où `creditCents` non persisté).
- Frontend : actions pures, normalisation déterministe.
- UI/UX/design : N/A (état pur).
- Data : clamp ≥0 + arrondi ; `partialize` whitelist stricte (pas de leak de montant volatile).
- A11y : N/A.
- i18n : N/A (le code est invariant de langue).
