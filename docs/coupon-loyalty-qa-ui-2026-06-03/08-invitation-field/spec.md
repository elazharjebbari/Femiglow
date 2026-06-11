# F08 — `InvitationCodeField` (saisie + validation d'un code de crédit fidélité)

## Rôle & surface
Permettre à **Yasmine** (cliente revenante) de saisir un code de crédit (`FG-XXXXXX`) et d'obtenir un
retour immédiat — crédit reconnu ou code refusé — **sans consommer** le code (prévisualisation seule ;
l'application réelle a lieu au paiement). Le code validé est remonté au parent (AddressStep → store →
total). Surface : `data-testid="invitation-code-field"`.
Fichier cible : `apps/web/src/components/sections/InvitationCodeField.tsx`.
Fichier de test : `src/components/sections/InvitationCodeField.msw.test.tsx`.

> **Extension, pas duplication.** Les cas purs existent déjà dans `InvitationCodeField.test.tsx`
> (U001 valide, U002 invalide, U003 <3 chars, U004 anti-stale) en mockant `fetch` à la main. Ce
> dossier **remonte la couche réseau sur MSW** (`redeemHandlers`) et ajoute les états de transition
> (`checking`), les variantes d'échec (500/network/payload malformé), tous les `reason`, et l'i18n AR.
> Les ids F08-C001/C002… ne rejouent PAS les U001-U004 : ils les complètent côté contrat MSW.

## Fonctionnement optimal (ce qui DOIT se passer)
Machine à états `Status` (cf. `flow.puml`) : `idle → checking → valid | invalid`, puis toute édition
post-résultat ramène à `idle`.

1. **idle** (montage) : champ vide ou `initialCode`, bouton « Appliquer » (FR) / « تطبيق » (AR). Le
   bouton est **désactivé** tant que `code.trim().length < 3`.
2. **Clic « Appliquer »** avec ≥3 chars → `checking` : le bouton affiche « … », `disabled` (anti
   double-soumission). `POST /api/coupons/redeem` avec `{ code: trim }`.
3. **valid** (`json.valid === true` ET `typeof valueCents === 'number'`) :
   - le bouton est **remplacé** par un médaillon coche sauge (`aria-hidden`, **plus de bouton**) ;
   - `<p data-testid="invitation-code-ok">` affiche FR `Crédit de {X} MAD appliqué — déduit au
     paiement.` / AR `رصيد {X} درهم صالح — يُطبَّق عند الدفع.` (`formatMad` = `cents/100` arrondi) ;
   - `onValid(code.toUpperCase(), valueCents)` est appelé **une fois**.
4. **invalid** (`valid` falsy ou `valueCents` non-numérique) : `<p data-testid="invitation-code-ko"
   role="alert">` affiche FR `Code introuvable ou expiré.` / AR `الرمز غير صالح أو منتهي.`. Le bouton
   « Appliquer » reste disponible (réessai). `onValid` **non** appelé.
5. **Anti-stale** : toute frappe dans le champ après un résultat (valid OU invalid) repasse en `idle`
   ET appelle `onClear()` — un crédit précédemment remonté doit être invalidé (re-validation requise).

## Contrat I/O
- **Props** : `isArabic?`, `onValid?(code, valueCents)`, `onClear?()`, `initialCode?`.
- **Endpoint** : `POST /api/coupons/redeem`, body `{ code: string }` (déjà `trim`, **pas** encore
  upper). Réponse `{ valid?: boolean; valueCents?: number; reason?: string }` (HTTP 200 dans tous les
  cas métier ; `catch` réseau → `invalid` reason `'error'`).
- **MSW** : `redeemHandlers({ byCode })` — `byCode` est clé par code **uppercased+trim** (le handler
  ré-upper avant lookup). `fail: 500 | 'network'`, `latencyMs` pour observer `checking`.
- **Émissions** : `onValid(c.toUpperCase(), valueCents)` sur succès ; `onClear()` à chaque ré-édition
  post-résultat. Aucune émission en `checking` ni en `invalid`.

## Cas limites & non-happy-path
- **<3 chars** : `check()` retourne tôt → **aucun** POST émis, état reste `idle`, bouton resté désactivé.
- **Latence** : `latencyMs > 0` → l'état `checking` est observable (« … », bouton `disabled`) avant la
  résolution.
- **500 / payload malformé** : si `res.json()` réussit mais sans `valid` → `invalid` reason `'invalid'`.
  Si `fetch`/`json` jette (network) → `catch` → `invalid` reason `'error'`. Dans les deux cas, le KO
  s'affiche, **pas** de `onValid`.
- **reason variés** : `not_found`, `expired`, `not_yet_active`, `already_redeemed`, `invalid_input` →
  tous rendus avec le **même** message KO sobre (le composant n'expose pas le reason brut à la cliente).
- **Casse / espaces** : `frbase-7212` saisi avec espaces → trim avant envoi ; `onValid` reçoit la
  version **upper** (`FG…`).
- **Anti-stale après valid** : éditer 1 caractère → `idle` + `onClear`, le médaillon coche disparaît,
  le bouton « Appliquer » réapparaît.
- **RTL AR** : `aria-label` = `رمز الدعوة`, bouton `تطبيق`, OK/KO en arabe avec `درهم`.
- **Charte** : aucun `%`/`!`/emoji/countdown ; couleur sauge (validé) / encre sobre (refus, **pas** de
  rouge agressif).

## Invariants couverts
- **Contrat redeem (non mutant)** : toute réponse est une prévisualisation ; le composant ne consomme
  jamais le code. Couvre la lacune d'audit « redeem côté UI non isolé via MSW ».
- **Anti-stale crédit** : garantit qu'un crédit obsolète n'est jamais transmis à la commande (support
  de **INV-422** en amont — le total reflète toujours un code re-validé).
- Charte voix maison (pas de `%`/`!`/emoji).

## Critères d'acceptation (observables)
- <3 chars → `redeemHandlers` ne reçoit **aucune** requête (compteur d'appels = 0) ; bouton `disabled`.
- Clic avec code valide → `invitation-code-ok` contient `Crédit de 20 MAD appliqué — déduit au
  paiement.` ; `onValid` appelé avec `('FG-SAUGE-7212', 2000)` ; **aucun** `<button>` dans le groupe.
- Pendant `checking` (latence) : le bouton textContent === « … » et `disabled === true`.
- Code refusé → `invitation-code-ko` (role=alert) contient `Code introuvable ou expiré.` ; `onValid`
  **non** appelé.
- 500 / network → KO affiché, `onClear`/`onValid` non appelés (résultat invalid).
- Ré-édition après valid → `onClear` appelé 1 fois, OK disparaît, bouton « Appliquer » réapparu.
- AR : `aria-label === 'رمز الدعوة'` ; OK contient `درهم` ; conteneur lisible RTL.
- Charte : textContent du champ ne matche pas `/[%!]|🎉|⏰/`.

## Points à vérifier — tous points de vue
- Backend : `/api/coupons/redeem` renvoie 200 + `{valid,reason}` (jamais 5xx pour un code métier).
- Frontend : transition `checking` bloque la double-soumission ; bascule bouton↔coche ; anti-stale.
- UI/UX/design : refus sobre (encre, pas de rouge), succès sauge, code en `uppercase tracking-wide`.
- Data : `valueCents/100` arrondi ; `onValid` upper+trim.
- A11y : OK = `<p>`, KO = `role="alert"` (annoncé), `aria-label` sur l'input.
- i18n : libellés FR/AR exacts ; `درهم` côté AR ; placeholder `FG-XXXXXX` partagé.
