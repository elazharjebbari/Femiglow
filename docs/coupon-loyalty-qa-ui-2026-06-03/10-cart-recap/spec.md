# F10 — `WizardCartRecap` (récap panier : économie d'accueil, crédit fidélité, total plancher)

## Rôle & surface
Bandeau récap panier permanent du wizard (visible pendant tout le tunnel). Met en récit l'économie du
geste d'accueil (terracotta), la ligne de crédit fidélité, le clin d'œil crédit post-achat, et calcule
le total final avec **plancher à 0**. Server Component pur (copies injectées en props).
Fichier cible : `apps/web/src/components/checkout/wizard/WizardCartRecap.tsx`.
Fichier de test : `src/components/checkout/wizard/WizardCartRecap.credit.test.tsx`.

> **Extension, pas duplication.** Couverture existante :
> - `WizardCartRecap.coupon.test.tsx` (U001 sans crédit, U002 crédit 2000→179, U003 crédit>total→0) ;
> - `WizardCartRecap.welcome.test.tsx` (W1→W12 : ligne welcome, terracotta, inactif, AR, coche,
>   forward credit, mobile insécable).
> Ce dossier ajoute les **frontières non couvertes** : crédit négatif (clamp), crédit == total exact,
> devise localisée (درهم) propagée dans total ET ligne crédit, coexistence welcome + crédit, compareAt
> remplacé, panier vide → null, `appliedCreditCents` absent (défaut 0). Les ids F10 ne rejouent pas
> U001-U003 / W1-W12 : ils ciblent les trous.

## Fonctionnement optimal (ce qui DOIT se passer)
- **Total après crédit** : `credit = Math.max(0, Math.min(appliedCreditCents, cart.totalCents))` ;
  `totalAfterCredit = cart.totalCents − credit` (donc plancher 0 ET clamp négatif). `wizard-cart-recap-total`
  affiche `{totalAfterCredit/100} {devise}` en `tabular-nums`.
- **Ligne crédit** : `wizard-credit-line` rendue **seulement si `credit > 0`**, libellé
  `creditLabel(montant)` (défaut FR `Crédit fidélité −{X}`), classe `text-sauge`.
- **Économie d'accueil** : `welcomeEconomyCents = compareAtTotalCents − totalCents`. Si
  `welcomeCoupon.active && welcomeEconomyCents > 0` → `wizard-welcome-coupon` (coche sauge + label) +
  `wizard-welcome-economy` en accent terracotta `#C28A6E` (`−{X}` mobile / `Économie {X}` desktop).
- **Clin d'œil crédit post-achat** : `wizard-welcome-forward` rendu si `showWelcome &&
  postPurchaseCreditCents > 0` ; libellé `forwardCreditLabel(montant)`. Forward = pas une 2ᵉ remise sur
  CE panier (conforme non-cumul affichage).
- **Devise localisée** : `currencyLabel` remplace `cart.currency` dans le total, la ligne crédit, et le
  prix barré (`priceCompareAt.replace(cart.currency, currencyLabel)`).
- **Prix barré** : `wizard-cart-recap-compare-at` rendu si `compareAtLabel` présent (line-through).

## Contrat I/O
- **Props** : `cart` (CartSnapshot : `items[]`, `totalCents`, `compareAtTotalCents?`, `currency`),
  `thumbnailSrc?`, `priceCompareAt?`, `currencyLabel?`, `appliedCreditCents = 0`, `creditLabel?`,
  `welcomeCoupon?{ active, postPurchaseCreditCents? }`, `welcomeLabel?/welcomeLabelShort?`,
  `economyLabel?`, `forwardCreditLabel?`, `ariaLabel?`, `packLabel?`, `shippingIncludedLabel?`.
- **Sortie** : `JSX | null` (null si `!cart || items vides`). Aucun événement, aucun endpoint.

## Cas limites & non-happy-path
- **`appliedCreditCents` absent** → défaut 0 → pas de ligne crédit, total inchangé (non-régression).
- **Crédit négatif** (`-500`) → `Math.max(0, …)` → `credit = 0`, total inchangé, pas de ligne crédit.
- **Crédit == total exact** (19900 == 19900) → total `0 MAD`, ligne crédit `−199 MAD` présente.
- **Crédit > total** (déjà U003) — ici on vérifie en plus la **ligne crédit plafonnée** au total.
- **Devise localisée** (`درهم`) : total ET ligne crédit ET barré contiennent `درهم`, pas `MAD`.
- **Coexistence welcome + crédit** (INV-NONCUMUL affichage) : `wizard-welcome-economy` ET
  `wizard-credit-line` coexistent sur lignes distinctes.
- **welcomeCoupon.active false** → pas de ligne welcome (non-régression W4).
- **compareAt absent** → pas de ligne welcome même si actif (W5) ni de prix barré.
- **panier vide / items=[]** → composant rend `null`.
- **Charte** : économie en terracotta `#C28A6E`, jamais de rouge/`%`/`!`/emoji ; montants `tabular-nums`.

## Invariants couverts
- **INV-422 (affichage)** : le total affiché = total débité après crédit (plancher 0). Verrouille le
  calcul d'affichage qui doit matcher `expectedTotalCents` envoyé à la commande.
- **INV-NONCUMUL (affichage)** : welcome (auto) + crédit fidélité (manuel) coexistent sur des lignes
  distinctes — jamais fusionnés en un seul montant.
- Charte : terracotta réservé à l'économie, pas de `%`/`!`/emoji.

## Critères d'acceptation (observables)
- `appliedCreditCents` absent → `queryByTestId('wizard-credit-line')` null ; total === `199 MAD`.
- `appliedCreditCents = -500` → pas de ligne crédit ; total === `199 MAD`.
- `appliedCreditCents = 19900` (== total) → total === `0 MAD` ; ligne crédit présente.
- `currencyLabel = 'درهم'` → `wizard-cart-recap-total` et `wizard-credit-line` contiennent `درهم`,
  ne contiennent pas `MAD`.
- welcome actif + crédit > 0 → `wizard-welcome-economy` ET `wizard-credit-line` tous deux présents.
- `wizard-welcome-economy` a la classe/couleur `text-[#C28A6E]` (terracotta).
- `cart.items = []` → le rendu est `null`.
- textContent du recap ne matche pas `/[%!]|🎉|⏰/`.

## Points à vérifier — tous points de vue
- Backend : `compareAtTotalCents` / `totalCents` viennent du snapshot (source `resolveProductPricing`).
- Frontend : clamp `Math.max(0, Math.min(...))` ; rendu conditionnel des lignes ; null si panier vide.
- UI/UX/design : terracotta sur économie uniquement, `tabular-nums`, coche sauge succès, mobile insécable.
- Data : `cents/100` arrondi (`toFixed(0)`) ; devise substituée dans toutes les chaînes formatées.
- A11y : `role="region"` + `aria-label` ; coche `aria-hidden`.
- i18n : libellés injectés (FR par défaut, AR/EN via props) ; chiffres latins conservés.
