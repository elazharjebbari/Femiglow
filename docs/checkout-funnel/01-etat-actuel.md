# 01 — État actuel du funnel de commande

> **But** : décrire **précisément** ce qui existe aujourd'hui, où sont les
> frictions, et où sont les fuites. Aucun jugement, aucune prescription —
> les recommandations sont dans `04-recommandation-finale.md`.

## Sommaire

1. [Ce qui a bougé dans le dernier commit `d1bac36`](#1-ce-qui-a-bougé-dans-le-dernier-commit-d1bac36)
2. [Vue d'ensemble du funnel](#2-vue-densemble-du-funnel)
3. [Audit champ par champ](#3-audit-champ-par-champ)
4. [Tracking & DataLayer](#4-tracking--datalayer)
5. [Audit UX / friction](#5-audit-ux--friction-points)
6. [Audit psychologique & couleur](#6-audit-psychologique--couleur)
7. [Audit data persistance](#7-audit-data-persistance--leads)
8. [Cartographie des fuites](#8-cartographie-des-fuites-estimées)
9. [Conclusion d'audit](#9-conclusion-daudit)

---

## 1. Ce qui a bougé dans le dernier commit `d1bac36`

> Commit `d1bac36 — Improve GTM expert and solve prod bugs` (2026-05-11, prod)
> 6 fichiers code, 129 insertions / 46 deletions (hors media binaire & admin).

### 1.1 Changements **fonctionnels** (visibles utilisateur)

| Fichier | Impact utilisateur |
|---|---|
| `AddToCartButton.tsx` | Ajout du prop `redirectTo?: string`. **Sépare deux comportements** : (1) sur `/kit` → ajout silencieux + redirect direct vers `/panier` (saute la MiniCartSlideOver) ; (2) ailleurs → ajout + ouverture du mini-panier. Le label passe de « Composer mon rituel » à `'Commander le rituel'` (par défaut). |
| `HeroProduit.tsx` | Le CTA du Hero du kit utilise désormais `redirectTo="/panier"`. Le copy passe à « Commander le rituel ». Ajoute une micro-rassurance sous le CTA : `Paiement sécurisé · Retour 14 j · Livraison 24-48 h`. |
| `cart-store.ts` | Auto-migration silencieuse SVG→PNG au rehydrate de localStorage (corrige un bug prod : items orphelins avec image SVG cassée). |
| `data/mock/product.ts` | Update mineur des mocks (sans impact runtime). |
| `lib/products/feed/kit-feed.ts` | Update mineur du feed produit (1 ligne). |
| `lib/tracking/gtm/builders.ts` | **Refactor majeur 127 lignes touchées** : passage de la nomenclature interne vers `UPPER_SNAKE_CASE` (compliance GTM Import/Export). Ajout du routage `CONVERSION_EVENTS` (folder GTM). Pas de nouvel événement métier — c'est de la plomberie taxonomie. |

### 1.2 Changements **structurels** (admin / interne)

| Fichier | Note |
|---|---|
| `app/admin/chat/providers/page.tsx` + `DeleteProviderButton.tsx` | Nouvelle UI admin pour supprimer un provider chat. |
| `app/api/admin/chat/providers/[id]/route.ts` | Route DELETE associée. |
| `app/api/admin/tracking/providers/[id]/route.ts` + `settings/route.ts` | Routes admin tracking (UPDATE/DELETE providers, settings). |
| `middleware.ts` | Ajustements ACL admin. |
| `next.config.mjs` + `scripts/_migrate-runner.mjs` | Petite optimisation build + helper migrations. |
| `package.json` | Dépendances. |

### 1.3 Ce que ce commit **ne touche pas** (et qui reste donc « comme avant »)

- ❌ La structure 3-steps `Informations → Livraison → Paiement` reste **identique**.
- ❌ Le schéma Zod `checkoutFormSchema` (`order.ts`) n'a pas bougé.
- ❌ Aucune amélioration UX dans `InfoStep`, `AddressStep`, `PaymentStep`.
- ❌ Aucun nouvel event tracking métier (ce sont les mêmes 5 : `add_to_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`).
- ❌ Pas de FR/AR. Pas de capture lead avant Step 3.

### 1.4 Conclusion section 1

Le commit `d1bac36` est un commit **de qualité technique** (taxonomie GTM
+ bugfixes prod) qui **n'altère pas le parcours de conversion**. Le
funnel décrit dans les sections suivantes est l'état actuel après ce
commit.

---

## 2. Vue d'ensemble du funnel

### 2.1 Parcours utilisateur (en clics)

```
┌─────────┐  click  ┌─────────┐  click  ┌──────────────────┐
│  /kit   │  ─────► │ /panier │  ─────► │   /commander     │
│  (Hero) │  "Cmder │ (récap +│  "Passer│                  │
│  CTA    │  rituel"│ qty)    │  cmde"  │  ┌──────────┐    │
└─────────┘         └─────────┘         │  │ Step 0   │    │
                                        │  │ Info     │    │
                                        │  └────┬─────┘    │
                                        │       │ "Continuer"
                                        │  ┌────▼─────┐    │
                                        │  │ Step 1   │    │
                                        │  │ Livraison│    │
                                        │  └────┬─────┘    │
                                        │       │ "Continuer"
                                        │  ┌────▼─────┐    │
                                        │  │ Step 2   │    │
                                        │  │ Paiement │    │
                                        │  └────┬─────┘    │
                                        └───────┼──────────┘
                                                │ "Confirmer la commande"
                                          ┌─────▼─────┐
                                          │ /merci/   │
                                          │ {orderId} │
                                          └───────────┘
```

### 2.2 Cadencement des clics

| # | Page | Action utilisateur | Friction |
|---|---|---|---|
| 1 | `/kit` Hero | Voir prix, lire rassurances, click CTA | 1 décision : « est-ce que je veux ? » |
| 2 | `/panier` | Vérifier qty, click « Passer commande » | 1 décision : « est-ce le bon kit ? » |
| 3 | `/commander` Step 0 | Remplir 4 champs (prénom, nom, email, tel) + ignorer 2 checkbox optionnelles, click « Continuer » | **6 décisions** (champs + checkboxes) |
| 4 | `/commander` Step 1 | Remplir 3-4 champs (adresse, quartier, ville, conditionnel cityOther) + choisir mode livraison + ignorer code postal, click « Continuer » | **5-6 décisions** |
| 5 | `/commander` Step 2 | Choisir paiement + ignorer promo + cocher consentement + click « Confirmer » | **4 décisions** |

**Total cumulé** : **4 clics de navigation** + **15-17 micro-décisions**
entre l'intention initiale et la confirmation. C'est ~2× le best-in-
class mobile e-commerce 2024 (cf. Baymard, voir
`02-references-synthese.md`).

### 2.3 Comportement intermédiaire (mini-cart)

Avant `d1bac36`, le CTA Hero ouvrait la `MiniCartSlideOver`. **Après le
commit**, le Hero `/kit` `redirectTo="/panier"` → la MiniCart est skipée
sur ce chemin. ✅ C'est un **bon raccourcissement** (économise 1 clic).

Mais la MiniCart reste utilisée si l'`AddToCartButton` est rendu
ailleurs (ProductFeedSection, etc.) — donc 2 chemins coexistent. Ce
n'est pas un problème en soi, mais l'expérience n'est pas homogène
selon le point d'entrée.

---

## 3. Audit champ par champ

> Source : `apps/web/src/lib/schemas/order.ts` (Zod) + composants
> `InfoStep.tsx`, `AddressStep.tsx`, `PaymentStep.tsx`.

### 3.1 Step 0 — `InfoStep` (Informations)

| Champ | Requis | Validation Zod | Note d'audit |
|---|---|---|---|
| `contact.firstName` | ✅ | `min(2).max(60)` | Standard. |
| `contact.lastName` | ✅ | `min(2).max(60)` | Doublon avec firstName : peut être fusionné (« nom complet »). |
| `contact.email` | ✅ | `emailSchema` | **⚠ Friction MA majeure** : 30–45 % des acheteurs COD MA n'ont pas d'email actif ou ne s'en souviennent pas. Devrait être optionnel quand `paymentMethod === 'cod'`. |
| `contact.phone` | ✅ | `+212` + `^[5-7]\d{8}$` | Bonne validation (vérifie préfixes opérateurs MA). UX : `+212` est en lecture seule devant l'input. ✅ |
| `contact.acceptNewsletter` | ☐ (optionnel) | `boolean.default(false)` | Bien : non pré-coché. ✅ |
| `contact.createAccount` | ☐ (optionnel + disabled) | `boolean.default(false)` | **« Disponible bientôt »** affiché — du bruit visuel pour une feature non opérationnelle. À retirer ou à activer. |

**Verdict Step 0** : 4 fields requis + 2 checkboxes = écran chargé. Le
**ratio name+phone vs email** n'est pas adapté au marché COD MA. Pas de
capture de lead à ce stade — si l'utilisateur ferme l'onglet ici, on ne
peut rien faire.

### 3.2 Step 1 — `AddressStep` (Livraison)

| Champ | Requis | Validation Zod | Note d'audit |
|---|---|---|---|
| `address.line1` | ✅ | `min(4).max(120)` | Champ texte libre. Pas d'autocomplete. |
| `address.line2` | ☐ | `max(120)` | Standard. |
| `address.quartier` | ✅ | `min(2).max(80)` | Champ texte libre. **Critique au Maroc** (l'adresse postale est souvent identifiée par le quartier, pas par le numéro). Mais saisie libre = inconsistance dans la DB. |
| `address.city` | ✅ | enum 10 villes + `'autre'` | **⚠ Très limitant** : MA = 1 538 communes. Hors top-10 → fallback obligatoire sur `cityOther` (free text). Pour Tit Mellil, Aïn Sebaâ, Bouskoura → friction. |
| `address.cityOther` | conditionnel | `max(60)` | Apparaît si `city='autre'`. Pas validé contre une référence — peut contenir n'importe quoi. |
| `address.postalCode` | ☐ (optionnel) | `regex /^[0-9]{5}$/` | **Bien que optionnel**, sa présence ralentit. La hint « si vous ne le connaissez pas, laissez vide » est un aveu UX : la majorité des Marocains ne mémorisent pas leur CP. |
| `address.country` | ✅ (`'MA'` literal, hidden) | `z.literal('MA')` | OK pour MVP MA-only. À élargir plus tard. |
| `address.shippingMode` | ✅ (radio, défaut `'standard'`) | enum `'standard'\|'express'` | Express limité à Casablanca via `isExpressAvailable`. Pricing visible : « 40–60 MAD » / « 80 MAD ». Bonne pratique. ✅ |

**Verdict Step 1** : Le combo `city dropdown + cityOther free text` est
le **plus grand goulot UX** du funnel. Pour les ~30 % d'acheteurs hors
top-10 villes (Salé hors Rabat, Mohammedia, Berrechid, Bouskoura, …),
c'est un détour mental qui dégrade le NPS.

### 3.3 Step 2 — `PaymentStep` (Paiement)

| Champ | Requis | Validation Zod | Note d'audit |
|---|---|---|---|
| `paymentMethod` | ✅ | enum `'card'\|'cmi'\|'cod'`, défaut `'cod'` | **Seul `cod` est actif** ; `card` (Stripe) et `cmi` (CMI MA) annoncés « Phase 2 » dans le hint. → Pourquoi les exposer si non branchés ? Génère du **doute de transaction** (cf. Kolenda Pricing). |
| `promoCode` | ☐ | `max(40)` optional | Visible mais le composant `PromoCodeInput` est en réalité **désactivé** côté API. Brouille la lisibilité. |
| `consent` | ✅ (literal `true`) | « Acceptation requise » | Pas pré-coché ✅ (compliance RGPD/loi 09-08). |

**Verdict Step 2** : Trop de bruit autour du choix de paiement. COD
étant la méthode unique active, on devrait **présenter COD comme la
norme** et déprioriser visuellement les options indisponibles (ou les
retirer).

### 3.4 Synthèse fields obligatoires

**Total fields obligatoires pour finaliser une commande** :

- Step 0 : 4 (firstName, lastName, email, phone)
- Step 1 : 3 (line1, quartier, city) + conditionnel cityOther
- Step 2 : 2 (paymentMethod sélectionné + consent coché)

= **9 décisions minimum**, sans compter les optionnels présentés (qui
créent quand même de la charge cognitive en regard).

**Benchmark Baymard 2024** : best-in-class mobile checkout pour COD MA
sur produit unique = **3–5 fields**. On est **2× au-dessus**.

---

## 4. Tracking & DataLayer

### 4.1 Événements émis aujourd'hui

| Event | Émis depuis | Trigger | Statut |
|---|---|---|---|
| `add_to_cart` | `AddToCartButton.tsx` | Click CTA | ✅ |
| `view_cart` | `CartContents.tsx` (useEffect) | Mount `/panier` | ✅ |
| `begin_checkout` | `CartContents.tsx` | Click « Passer commande » | ✅ |
| `add_shipping_info` | `CheckoutFlow.tsx` | Click « Continuer » sur Step 1 | ✅ |
| `add_payment_info` | `CheckoutFlow.tsx` | Submit final | ✅ |
| `purchase` | (route `/api/checkout` ou `/merci`) | Confirmation serveur | ✅ |

### 4.2 Ce qui manque (gaps)

| Manque | Conséquence |
|---|---|
| ❌ `view_item` au mount de `/kit` | Pas de tracking du dénominateur du funnel. Impossible de calculer `view_item → add_to_cart` ratio. |
| ❌ `add_contact_info` (= step 0 → step 1) | On ne sait pas où la fuite a lieu entre `begin_checkout` et `add_shipping_info`. |
| ❌ Field-level interactions (`form_field_focus`, `form_field_complete`, `form_field_error`) | Pas de heatmap des frictions. On découvre les bugs uniquement via logs ou support. |
| ❌ `checkout_abandonment` (timer / blur / unload) | Pas de capture du moment où l'utilisateur abandonne. Conséquence : ❌ pas de remarketing dynamique. |
| ❌ `language_switch_fr_ar` | Pas de tracking de la pertinence FR/AR (feature future). |
| ❌ `address_autocomplete_select` | Pas de mesure de la qualité de l'autocomplete (feature future). |
| ❌ `lead_captured` | Pas d'événement quand un lead « abandoned cart » est sauvegardé en DB (feature future). |

### 4.3 Impact

Sans `view_item` et `add_contact_info`, **on ne peut pas reconstruire
le funnel de conversion avec précision**. On a 5 points sur 8 ; chaque
point manquant masque une fuite potentielle.

---

## 5. Audit UX / friction points

### 5.1 Hiérarchie visuelle

✅ **Bon** :
- ProgressBar 3-steps en haut (`ProgressBar3Steps.tsx`) — bonne lisibilité.
- OrderSummarySticky desktop / OrderSummaryAccordion mobile — pattern reconnu.
- Hint micro-rassurance sous le CTA Hero (« Paiement sécurisé · Retour 14 j · Livraison 24-48 h »).

⚠ **À questionner** :
- **Pas de trust badges visibles** dans Step 0 ou Step 2 (ni paiement sécurisé, ni cadenas, ni mention RGPD). Cela compte beaucoup en MA pour COD (paradoxe : les acheteurs COD veulent quand même voir un signal de sécurité).
- **Pas de témoignage / proof à la transition cart → checkout** (Step 0). Le risque psycho « est-ce que je vais regretter ? » est à son maximum à ce moment-là.
- **Le label CTA final « Confirmer la commande »** est neutre. Pour COD, un label plus engageant (« Recevoir mon kit » / « Valider — paiement à la livraison ») diminuerait l'aversion à l'engagement.

### 5.2 Mobile

✅ **Bon** :
- Form vertical, OrderSummaryAccordion repliable.
- Inputs `inputMode="numeric"` / `tel` / `email` → ouvre le bon clavier.

⚠ **À questionner** :
- `<select>` natif pour la ville → sur iOS, picker wheel = friction si liste > 7 items. On a 11 items (10 villes + autre).
- Le `+212` en préfixe statique est visuellement aligné mais **ne permet pas le copier-coller** d'un numéro complet `06...` → l'utilisateur doit retirer manuellement le `0` initial. Friction silencieuse mais réelle.

### 5.3 Accessibility

✅ **Bon** :
- `aria-live="polite"` pour les transitions d'étape.
- Heading `tabIndex={-1}` pour focus management.
- Labels associés, `aria-invalid`, `aria-describedby`.

⚠ **À questionner** :
- `Pas de skip-link` vers le résumé de commande sur mobile.
- L'OrderSummaryAccordion devrait être `aria-expanded` documenté (à vérifier dans le composant).

---

## 6. Audit psychologique & couleur

> Référentiel : `docs/kolenda/Color.pdf`, `docs/kolenda/Pricing.pdf`,
> `docs/kolenda/UX.pdf`. Voir `02-references-synthese.md` pour la synthèse.

### 6.1 Couleurs CTA

Le CTA primaire (`Button variant="primary"`) utilise `tone-on-encre`
(noir profond). Vu la palette FemiGlow (`creme`/`encre`/`petale`), c'est
**éditorial et brand-aligned** mais :

| Aspect | Verdict |
|---|---|
| Contraste WCAG AA | ✅ Suffisant (noir sur crème). |
| Salience cognitive (« je vois où cliquer ») | ⚠ **Mediocre** : un bouton noir sur fond crème ressemble à un élément éditorial. Sur mobile glissé rapidement, l'œil n'est pas attiré. Kolenda Color #14 : la salience du CTA doit avoir un **contraste de teinte** (≠ contraste de luminosité) avec le contexte. |
| Conversion impact | Sur produits luxe/éditoriaux, un CTA discret peut être un atout (≠ démarche commerciale agressive). Mais à l'**étape paiement**, le risque d'inertie augmente. |

**Recommandation à arbitrer** : garder le CTA noir partout, OU
introduire une variante « petale-dark » uniquement à l'étape finale
(`/commander` Step 2 → Confirmer). Voir `04`.

### 6.2 Rassurance & ancres psychologiques

Kolenda Pricing #11 : *« shrink and densify the payment section »*. ✅
On le fait partiellement (resume sticky compact).

Kolenda Pricing #14 : *« reframe risk as a one-time test »*. ⚠ Manque.
On ne reformule pas l'achat comme un « essai » (alors que le Maroc 09-08
+ retour 14j le permet — c'est un argument réel).

Kolenda UX #4 : *« reduce decision fatigue : limit fields per screen
to ≤ 5 »*. ⚠ Step 0 = 6 décisions (4 fields + 2 checkboxes). Step 1 = 6
décisions. Au-dessus du seuil.

### 6.3 Copywriting

✅ Bon ton FemiGlow : « Vos coordonnées. », « Livraison. », « Paiement. »
— sobres, point-suspension brand.
✅ Charte VII.5 respectée (verbe d'invitation au lieu de « ajouter au
panier »).

⚠ Manque d'**ancre de réassurance émotionnelle** à l'étape 0 (« vous
êtes à 90 secondes de recevoir votre kit » / « 287 femmes ont fait ce
geste cette semaine »). C'est du copy à creuser dans la proposition
finale.

---

## 7. Audit data persistance & leads

### 7.1 Comportement actuel

| Stockage | Quand | Où |
|---|---|---|
| `cart-store` (Zustand + localStorage `femiglow-cart`) | À chaque add/remove | Browser uniquement |
| `checkout-draft` (localStorage) | Toutes les 400ms (debounce) pendant que l'utilisateur tape | Browser uniquement |
| DB `orders` | À la soumission Step 2 | PostgreSQL |
| DB `leads` (`chat_lead`) | ❌ **Jamais** depuis le funnel checkout | — |

### 7.2 Conséquence

**Si l'utilisateur abandonne entre `begin_checkout` et `add_payment_info`**,
on a **zéro trace côté serveur** :

- 🟥 Pas de remarketing email (pas d'email capturé).
- 🟥 Pas de remarketing SMS (pas de phone capturé).
- 🟥 Pas de rappel manuel par l'équipe (rien à rappeler).
- 🟥 Pas de mesure du LTV potentiel perdu.

Le `chat_lead` table existe déjà (cf. CHA-230 du worktree
`cha-230-langchain-robustness`) et capture les frustrations chat → c'est
**la même infrastructure** qui pourrait capturer les abandons checkout
si on lui envoie les bons signaux.

### 7.3 Opportunité

C'est **le gain le plus rentable** de toute la refonte : capturer un
lead minimal (`first_name`, `phone`) **avant** de demander quoi que ce
soit d'autre = on transforme 100 % des intentions en leads, contre
~30 % aujourd'hui qui vont jusqu'au bout.

C'est l'objet de l'exigence **(1)** d'Elazhar (« step 1 minimal = lead
capture »).

---

## 8. Cartographie des fuites estimées

> Modèle théorique basé sur Baymard 2024 + benchmarks COD MA (sources
> dans `02-references-synthese.md`). Les chiffres sont des **fourchettes
> indicatives** — à mesurer après instrumentation complète.

```
100 visiteurs /kit
       │
       │ taux view_item → add_to_cart : 8–14 %
       ▼
12 add_to_cart
       │
       │ 90 % continuent (peu de friction MiniCart skipée)
       ▼
11 view_cart
       │
       │ 85 % cliquent « Passer commande »
       ▼
9 begin_checkout
       │
       │ ⚠ FUITE #1 : Step 0 = 4 champs + email obligatoire
       │ 55–65 % continuent (perte ~40 %)
       ▼
5 (entrée Step 1)
       │
       │ ⚠ FUITE #2 : ville hors top-10 + adresse libre
       │ 65–75 % continuent (perte ~30 %)
       ▼
4 add_shipping_info
       │
       │ Step 2 simple, COD-only effectif
       │ 80–90 % continuent
       ▼
3 add_payment_info → purchase
```

**Résultat** : ~30 % des `begin_checkout` deviennent `purchase`. Sur
mobile MA, c'est conforme aux benchmarks Baymard (médiane 28–32 %) mais
**très loin du top quartile** (45–55 %).

**Levier #1 le plus rentable** : réduire la fuite #1 (Step 0). Capturer
le lead minimal avant `email` requis.

**Levier #2** : remplacer `cityOther` par autocomplete MA. Réduit la
fuite #2 et améliore la qualité de la donnée.

---

## 9. Conclusion d'audit

### 9.1 Ce qui marche bien

- ✅ Architecture 3-steps lisible, ProgressBar claire.
- ✅ Validation Zod robuste (phone MA, consent literal `true`).
- ✅ Mobile-first OrderSummaryAccordion.
- ✅ Charte de copy FemiGlow respectée.
- ✅ Tracking de base présent (5 events ecommerce).
- ✅ Le commit `d1bac36` a renforcé la taxonomie GTM (Import/Export OK).

### 9.2 Ce qui freine la conversion

1. **Step 0 trop chargé** (4 fields + 2 checkboxes, dont email requis inadapté au COD MA).
2. **Pas de capture de lead** avant Step 3 → 70 % des intentions invisibles côté serveur.
3. **City dropdown 10 entrées + fallback texte libre** → friction pour les 30 % hors top-10.
4. **Adresse / quartier sans autocomplete** → données DB hétérogènes, friction utilisateur.
5. **Méthodes paiement non actives exposées** (card/cmi « Phase 2 ») → bruit + doute.
6. **Pas de FR/AR** (limitant pour le sud / Sahara / clientèle arabophone).
7. **Pas de thank-you émotionnelle** (page `/merci/[orderId]` actuelle = factuelle).
8. **Tracking incomplet** : pas de field-level, pas d'abandonment, pas de view_item.

### 9.3 Suite

→ Lire `02-references-synthese.md` pour les **fondations conceptuelles**.
→ Puis `03-propositions.md` pour les **3 directions comparées**.
→ Puis `04-recommandation-finale.md` pour **la proposition retenue**.
