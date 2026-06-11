# F11 — ThankYouStep + `LoyaltyCodeCard` (remise du code de fidélité en fin de parcours)

## Rôle & surface
En fin de commande, offrir à **Yasmine** un code de fidélité mémorable pour sa prochaine visite — geste
de la maison, pas un coupon retail. `ThankYouStep` lit `store.loyalty` et rend `LoyaltyCodeCard`
**seulement si** `loyalty.code` est présent. La carte affiche le code (`tabular-nums`), la valeur en
terracotta, la date d'activation civile (pas de countdown), un bouton copier.
Fichiers cibles : `apps/web/src/components/checkout/wizard/steps/ThankYouStep.tsx` +
`apps/web/src/components/checkout/LoyaltyCodeCard.tsx`.
Fichier de test : `src/components/checkout/wizard/steps/ThankYouStep.loyalty.test.tsx`.

> **Extension, pas duplication.** `LoyaltyCodeCard.test.tsx` couvre déjà la carte isolée (U001 code+
> valeur+activation, U002 copie, U003 charte, U004 sans activatesAt, U005 AR). Ce dossier teste le
> **câblage ThankYouStep ↔ store** : présence/absence conditionnelle selon `loyalty?.code`, propagation
> des props (`valueCents`, `activatesAt`, `isArabic`) depuis le store, et l'invariant **INV-PII** (aucun
> téléphone affiché sur l'écran merci). Les ids F11 ne rejouent pas U001-U005.

## Setup réaliste (à documenter dans le test)
`ThankYouStep` est un composant client qui lit le store et appelle `useOrderEmailConfirmationMutation` +
`useWizardTranslation`. Le test doit :
1. **semer le store** : `useWizardStore.setState({ orderId, loyalty, formContext: { language } })`,
   `reset()` en `afterEach` ;
2. **mocker `useOrderEmailConfirmationMutation`** (status idle, execute no-op) pour isoler le wiring
   loyalty du formulaire email ;
3. `navigator.clipboard.writeText` mocké (jsdom) pour le bouton copier ;
4. asserter sur les testids `loyalty-code-card` / `loyalty-code-value` / `loyalty-code-copy`.

## Fonctionnement optimal (ce qui DOIT se passer)
1. **`loyalty?.code` présent** → `<LoyaltyCodeCard code valueCents activatesAt isArabic/>` rendu, inséré
   entre la réf order et la carte email. `loyalty-code-value` affiche le code en `tabular-nums` ; la
   valeur affiche `{X} {MAD|درهم}` en terracotta `#C28A6E` ; ligne d'activation civile si `activatesAt`.
2. **`loyalty` null / sans code** → **aucune** `LoyaltyCodeCard` rendue (le reste de l'écran intact).
3. **Bouton copier** : clic → `navigator.clipboard.writeText(code)` ; le libellé passe « Copier » →
   « Copié » (FR) / « نسخ » → « تم النسخ » (AR) pendant 2s.
4. **Date d'activation civile** : `formatCivil(activatesAt)` via `Intl.DateTimeFormat('fr-MA'|'ar-MA',
   { day:'numeric', month:'long' })` → ligne « Utilisable à partir du {date} · valable 60 jours. ».
   Si `activatesAt` null/invalide → **pas** de ligne activation.
5. **AR** : `dir="rtl"` sur l'aside, copies arabes, `درهم`.

## Contrat I/O
- **Store lu** : `orderId`, `loyalty { code, valueCents, activatesAt }`, `formContext.language`.
- **LoyaltyCodeCard props** : `code`, `valueCents`, `activatesAt?`, `isArabic?`, `className?`.
- **Effet** : `navigator.clipboard.writeText(code)` au clic copier (catch silencieux si indispo).
- **Aucun endpoint** côté carte ; le store est seedé par le flux Phase 3 (`setLoyalty`).

## Cas limites & non-happy-path
- **loyalty null** → carte absente (non-régression : l'écran merci reste fonctionnel).
- **loyalty.code vide / falsy** → carte absente (gate `loyalty?.code`).
- **activatesAt null** → carte rendue **sans** ligne activation (le code + valeur restent lisibles).
- **activatesAt invalide** (`'not-a-date'`) → `formatCivil` renvoie null → pas de ligne activation, pas
  de crash.
- **clipboard indisponible** (writeText rejette) → catch silencieux, le code reste sélectionnable, pas
  de bascule « Copié ».
- **AR** → `dir="rtl"`, copies arabes, `درهم`.
- **INV-PII** : aucun numéro de téléphone affiché sur l'écran merci ni dans la carte (le code n'est PAS
  le téléphone) ; oracle : le textContent de l'écran ne matche pas `/\d{6,}/` (hors orderId si purement
  alphanumérique — vérifier que l'orderId fixture n'introduit pas 6 chiffres consécutifs).
- **Charte** : valeur terracotta `#C28A6E` ; aucun `%`/`!`/emoji/countdown.

## Invariants couverts
- **INV-PII** : le téléphone de la cliente n'apparaît jamais sur l'écran de remerciement (le code de
  fidélité est lié au numéro côté backend mais n'expose pas le numéro).
- Charte : terracotta sur la valeur, pas de countdown (date civile uniquement).
- Lacune d'audit : « ThankYouStep wiring loyalty » non testé bout-en-bout.

## Critères d'acceptation (observables)
- Store avec `loyalty.code='FG-SAUGE-7212'` → `loyalty-code-card` présent ; `loyalty-code-value`
  contient `FG-SAUGE-7212`.
- Store `loyalty = null` → `queryByTestId('loyalty-code-card')` null.
- Store `loyalty.code` falsy → carte absente.
- Clic `loyalty-code-copy` → `navigator.clipboard.writeText` appelé avec le code ; libellé devient
  « Copié ».
- `activatesAt` fourni → ligne contient une date civile (mois en lettres) ; `activatesAt` null → pas
  de ligne activation.
- AR : `loyalty-code-card` a `dir="rtl"` ; libellé copier « نسخ » ; valeur contient `درهم`.
- INV-PII : textContent de `wizard-step-thankyou` ne contient aucune séquence de 6 chiffres (téléphone).

## Points à vérifier — tous points de vue
- Backend : `setLoyalty` seedé par le flux d'émission (code lié au téléphone côté serveur, non exposé).
- Frontend : rendu conditionnel `loyalty?.code` ; propagation `valueCents`/`activatesAt`/`isArabic`.
- UI/UX/design : valeur terracotta, code `tabular-nums`, bouton copier discret, pas de countdown.
- Data : `formatCivil` tolère null/invalide ; `valueCents/100` arrondi.
- A11y : bouton copier `aria-label` ; carte `<aside>`.
- i18n : `dir="rtl"` AR ; `درهم` ; date `ar-MA`/`fr-MA`.
- **Sécurité/PII** : aucun téléphone affiché ; pas de 6 chiffres consécutifs sur l'écran.
