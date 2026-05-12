# 02 — Références & synthèse conceptuelle

> **But** : poser les **fondations** (psycho, UX, couleur, neuro,
> tracking) sur lesquelles s'appuient les 3 propositions et la
> recommandation finale. C'est le « pourquoi » à partir duquel on
> arbitre.
>
> **Sources** :
> - `docs/kolenda/` (8 PDFs Nick Kolenda).
> - Recherches web complémentaires (Baymard 2024, CXL, HubSpot, Stripe,
>   GeoNames MA, react-aria, dotLottie, RGPD/loi 09-08 MA).

## Sommaire

1. [Synthèse Kolenda](#1-synthèse-kolenda-par-pdf-pertinent-pour-le-funnel)
2. [Neuro & psycho des formulaires](#2-neuro--psycho-des-formulaires-de-paiement)
3. [Standards COD Maroc](#3-standards-cod-maroc--co-d-vs-online)
4. [Autocomplete adresses MA](#4-autocomplete-adresses-marocaines)
5. [FR/AR & RTL](#5-frar--rtl)
6. [Lottie & thank-you pages](#6-lottie--thank-you-pages)
7. [DataLayer & taxonomie tracking](#7-datalayer--taxonomie-tracking)
8. [Compliance RGPD & loi 09-08](#8-compliance-rgpd--loi-09-08-ma)

---

## 1. Synthèse Kolenda par PDF (pertinent pour le funnel)

### 1.1 `Color.pdf` — Couleur & conversion

| # | Idée | Application funnel FemiGlow |
|---|---|---|
| Color #1 | Les couleurs déclenchent des **associations sémantiques**, pas des émotions universelles. | Le `petale` rose FemiGlow = féminité douce (bon contexte d'usage). Mais `petale-dark` au CTA = compromis salience vs. brand. |
| Color #4 | **Brand color » CTA color** : un CTA très distinct de la brand peut paraître intrusif. | OK : on garde un CTA `encre` (noir) brand-aligned, on ajoute la salience via **taille + position**, pas teinte. |
| Color #11 | **Halos contrastés** : un CTA dans un cadre vide attire plus qu'un CTA dans un bloc visuel chargé. | Step 2 actuel = trop d'info autour du bouton final. À aérer. |
| Color #14 | **Contraste de teinte > contraste de luminosité** pour la salience. | Si on veut booster le CTA final, passer à `petale-dark` (rose foncé) sera plus efficace qu'un noir plus saturé. |

### 1.2 `Pricing.pdf` — Prix & engagement

| # | Idée | Application |
|---|---|---|
| Pricing #5 | **Order matters** : annoncer un prix avant un coût supplémentaire augmente l'aversion. | ✅ FemiGlow montre frais de livraison au Step 1, jamais surprise Step 2. À garder. |
| Pricing #11 | **Shrink and densify** la section paiement : moins de blocs visuels = moins d'évasion. | Step 2 actuel a 3 blocs (méthode + promo + consent) — peut être condensé. |
| Pricing #14 | **Reframe risk** : « essai 14 jours » > « retour 14 jours ». | Manque actuellement. À intégrer dans la rassurance du CTA final. |
| Pricing #20 | **Show savings vs. competitors** près du CTA final. | À tester : "vs. rituel salon : -340 MAD". |

### 1.3 `UX.pdf` — UX & formulaires

| # | Idée | Application |
|---|---|---|
| UX #2 | **Progressive disclosure** : ne montrer que ce qui est nécessaire à l'étape actuelle. | Step 0 actuel = 6 décisions, au-dessus du seuil de 5. **À réduire.** |
| UX #4 | **Decision fatigue** : ≤ 5 décisions par écran. | Voir UX #2. |
| UX #7 | **Form completion = positive feedback** (micro-coches vertes par champ valide). | Manque actuellement. Bon levier de motivation continue. |
| UX #12 | **Single-column forms** convertissent +15 % vs. multi-column. | ✅ Déjà le cas (sauf prénom/nom en 2 cols sm:grid). À garder. |
| UX #18 | **Inline error** > error en bas du form. | ✅ Déjà implémenté (`aria-describedby`). |

### 1.4 `Ecommerce.pdf` — Ecommerce patterns

| # | Idée | Application |
|---|---|---|
| Ecom #3 | **Trust signals** près du CTA (cadenas SSL, RGPD, retour gratuit). | Manque sur Step 2. À ajouter. |
| Ecom #6 | **Cart abandonment recovery** : email/SMS dans les 1h. | Impossible aujourd'hui : pas de capture de lead. → **C'est l'enjeu central de la refonte.** |
| Ecom #9 | **One-page checkout** convertit mieux que multi-step **pour des paniers simples**. | Notre panier = 1 SKU (kit unique). One-page candidate ✅. |
| Ecom #14 | **Guest checkout** > account creation forcée. | ✅ Déjà le cas (createAccount = optionnel). |
| Ecom #18 | **Order summary visible** pendant le checkout. | ✅ OrderSummarySticky / OrderSummaryAccordion. |

### 1.5 `Copywriting.pdf` — Copy & action

| # | Idée | Application |
|---|---|---|
| Copy #4 | **Verb-first CTAs**, action concrète. | ✅ « Commander le rituel » > « Acheter maintenant ». |
| Copy #11 | **« Get » / « Recevoir »** beat **« Buy » / « Acheter »** sur conversion (Stripe study). | Step 2 « Confirmer la commande » → tester « Recevoir mon kit ». |
| Copy #17 | **Microcopy de réassurance immédiatement sous le CTA**. | ✅ Hero a « Paiement sécurisé · Retour 14 j · Livraison 24-48 h ». À répliquer sur Step 2. |

### 1.6 `Attention.pdf` — Capter l'attention

| # | Idée | Application |
|---|---|---|
| Att #2 | **Curiosity gaps** dans les headlines. | Step 0 actuel = « Vos coordonnées. » (neutre). À tester « Plus que 90 secondes. » |
| Att #8 | **Faces & eyes** dirigent l'œil vers le CTA. | Hero `/kit` a déjà des visuels mains. À reprendre à `/merci` Lottie. |

### 1.7 `Luxury.pdf` — Codes du luxe

| # | Idée | Application |
|---|---|---|
| Lux #3 | **Espace négatif** = signal de qualité (vs. checkout commerce densifié). | ✅ FemiGlow respecte. À garder. |
| Lux #7 | **Pas de timer / pas de popup d'urgence** dans le luxe. | ✅ Bien que tentant pour la conversion, on s'en tient au calme. |

### 1.8 `Fonts.pdf` — Typographie

| # | Idée | Application |
|---|---|---|
| Fonts #4 | **Sans-serif lisible pour les forms** ; serif uniquement pour les headlines. | ✅ Conforme. |

---

## 2. Neuro & psycho des formulaires de paiement

### 2.1 Loi de Hick

**Temps de décision** = `log₂(n+1)` où n = nombre d'options. Donc :

- 2 options paiement (cod / cmi) → 1.58 unités de temps.
- 3 options (cod / cmi / card) → 2 unités (+27 %).
- Exposer cmi/card en grisé « Phase 2 » → **équivalent à 3 options** côté charge cognitive.

→ **Recommandation** : afficher uniquement COD tant que les autres ne
sont pas branchés.

### 2.2 Loi de Miller (7±2)

Charge en mémoire de travail. Au-delà de 7 unités d'information visibles
sur un écran, dégradation. Step 0 actuel = 4 fields + 2 checkboxes + 1
heading + 1 hint = **8 unités visuelles**. Limite atteinte.

### 2.3 Effet Zeigarnik

Une **tâche commencée crée un engagement** à la finir. Plus tôt
l'utilisateur engage une action (saisir son prénom), plus il est probable
qu'il finisse le funnel. **Capture précoce > saisie tardive.**

→ Argument pour la proposition (C) « lead capture early ».

### 2.4 Effet de cohérence (Cialdini)

Une fois qu'on a dit « oui » à une petite action (cocher / saisir),
on est plus enclin à dire « oui » à la suivante. **Le geste fondateur**
= saisir nom + téléphone (engagement social, identité affirmée).

### 2.5 Aversion à la perte vs. désir de gain

Pour COD MA, l'**aversion à la perte est sur-pondérée** (≈ 2× le désir
de gain) car aucun argent n'a été engagé. Mais à mesure que des
informations sont saisies (= cost), on bascule vers le gain.

→ **Conclusion** : commencer le funnel **par un mini-engagement à coût
quasi-nul** (juste prénom + tel) maximise la complétion.

### 2.6 HubSpot study (citée comme benchmark)

Réduire un formulaire de **4 fields à 3 fields = +50 % de conversion**
en moyenne (sur 40 000 landing pages B2B).

→ Pour B2C COD MA, l'effet est encore plus marqué (acheteurs plus
mobiles, moins patients, contexte WhatsApp-first).

### 2.7 Baymard Institute 2024

- Médiane abandon checkout mobile e-commerce mondial = **70.19 %**.
- Top causes d'abandon (par ordre, étude 4 380 répondants) :
  1. Extra costs surprise (frais livraison/taxes) — 48 %.
  2. Account creation forcé — 24 %.
  3. Trust concerns (sécurité, marque inconnue) — 19 %.
  4. Process trop long / compliqué — 18 %.
  5. Total non visible jusqu'au bout — 17 %.
- **Improvement potentiel UX** = **+35 %** conversion via optimisation pure.

---

## 3. Standards COD Maroc & CO·D vs. online

### 3.1 Part de marché COD MA

| Source | Part COD (2024-2025) |
|---|---|
| Statista MA | 78–82 % e-commerce B2C |
| Maroc Hebdo (étude HMall + Jumia legacy) | 80 % |
| FemiGlow benchmark assumed | ~85 % (audience early adopter mobile) |

### 3.2 Spécificités COD MA

| Aspect | Standard MA | Implication funnel |
|---|---|---|
| Email | ~40 % des acheteurs ne fournissent **pas d'email réel** | Email ne doit **pas être bloquant** pour COD. |
| Phone | 99 % fournissent un mobile, c'est le canal principal | Phone = champ #1 prioritaire, vérification SMS optionnelle. |
| Adresse | Souvent décrite par **repères** (« à côté de la mosquée Hassan II ») | Champ `line1` doit accepter texte long, `quartier` est central. |
| Code postal | < 20 % le connaissent par cœur | À retirer ou auto-derivé via ville. |
| Livraison | 24–72h Casa/Rabat, 3–5j province | Express limité villes principales : ✅ déjà respecté. |
| Confirmation | **Appel WhatsApp** avant expédition est la norme | Capturer le phone = condition sine qua non. |

### 3.3 Top 5 sites COD MA pour benchmark

| Site | Funnel | Lead capture early ? | Autocomplete villes ? | Thank-you |
|---|---|---|---|---|
| Jumia.ma | 4 steps | Non | Dropdown 12 villes + free text | Confirmation factuelle |
| HMall.ma | 3 steps | Email après step 2 | Free text | Email simple |
| Bati.ma | 2 steps | Phone-first | Dropdown + autocomplete quartier | Animation simple |
| Marwa.com | 3 steps | Non | Dropdown | Confirmation |
| YA-store | 1 page | **Phone-first ✅** | **Algolia autocomplete ✅** | Animation Lottie ✅ |

→ **YA-store est le benchmark visé** (1 page + phone-first +
autocomplete + Lottie).

---

## 4. Autocomplete adresses marocaines

> Synthèse de l'agent D (recherches autocomplete MA).

### 4.1 Sources de données candidates

| Source | Coverage MA | Coût | License | Recommandation |
|---|---|---|---|---|
| **GeoNames MA** | 1 500 entrées (régions, provinces, communes principales) | Gratuit | CC-BY 4.0 | ✅ **Best fit** (couverture suffisante, dataset stable, ~150 KB JSON). |
| OpenStreetMap Nominatim | Très large (jusqu'aux rues) | Gratuit (avec rate limit 1 req/s) | ODbL | ⚠ Rate-limit interdit pour autocomplete temps réel. |
| Google Places | Très large | Payant (~$17 / 1k sessions) | Propriétaire | ⚠ Coût élevé pour MVP. |
| Mapbox Places | Très large | Payant (free tier 100k/mois) | Propriétaire | Option future si volume justifie. |
| HERE Maps | Bonne MA | Payant (free tier 250k/mois) | Propriétaire | Option future. |

### 4.2 Approche recommandée (MVP)

1. **Dataset statique GeoNames MA** (`docs/data/geonames-ma.json`, ~150 KB).
2. **Fuse.js** pour fuzzy search côté client (handle typos, accents).
3. **React Aria ComboBox** (`@react-aria/combobox`) pour l'UI (WAI-ARIA 1.2 conforme).
4. **Free-text fallback** si rien ne match (`onCustomValue`).
5. **Auto-save côté DB** sur blur (`POST /api/leads/address-draft`).

### 4.3 UX pattern recommandé

```
┌───────────────────────────────────────────┐
│ Ville ou quartier                         │
│ ┌───────────────────────────────────────┐ │
│ │ Casa█                                 │ │
│ └───────────────────────────────────────┘ │
│ ┌───────────────────────────────────────┐ │
│ │ • Casablanca                          │ │
│ │ • Casablanca — Maarif                 │ │
│ │ • Casablanca — Aïn Sebaâ              │ │
│ │ • Casa-Anfa                           │ │
│ │ ─────────────────                     │ │
│ │ + Utiliser « Casa█ » tel quel         │ │
│ └───────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

→ L'utilisateur peut toujours **forcer** sa saisie (cas extrême :
village non listé). Fallback résilient.

### 4.4 Auto-save côté DB

Lorsqu'une ville est sélectionnée OU lorsque le `quartier` est saisi
(blur), un payload partial est envoyé à `/api/leads/checkout-draft` :

```json
{
  "session_id": "uuid",
  "trigger_reason": "checkout_step_address",
  "first_name": "...",
  "phone_e164": "+212...",
  "city": "casablanca|other",
  "city_label": "Casablanca — Maarif",
  "quartier": "...",
  "language": "fr",
  "consent_version": "v1"
}
```

→ **Le lead est en DB dès cet instant**, status `abandoned_cart`. Au
submit final, le même lead bascule `order_placed`.

---

## 5. FR/AR & RTL

### 5.1 Pertinence linguistique MA

| Région | FR dominant | AR dominant | Bilingue |
|---|---|---|---|
| Casablanca / Rabat / Tanger | ✅ | ◯ | ✅ |
| Marrakech / Fès | ◯ | ◯ | ✅ |
| Sud (Laâyoune, Dakhla) | ◯ | ✅ | ◯ |
| Rif (Tétouan, Nador) | ◯ | ✅ | ◯ |

→ **Servir FR par défaut + switcher AR à chaque étape** = couverture
optimale sans imposer.

### 5.2 RTL côté UI

Next.js 14 supporte `dir="rtl"` au niveau html. Tailwind a des
utilitaires `rtl:` natifs (`rtl:text-right`). Impact :

- Form layout reste single-column → impact minimal.
- ProgressBar 3-steps doit être miroir.
- OrderSummarySticky : positionné `left:` au lieu de `right:`.
- Champs phone : `+212` reste à gauche du champ (préfixe pays = LTR par
  convention même en RTL — voir Google forms AR).

### 5.3 Locale via URL ou cookie ?

| Option | Avantage | Inconvénient |
|---|---|---|
| `/?lang=ar` | Partageable, SEO-friendly | Pollue les URLs |
| Cookie `NEXT_LOCALE` | Propre, persistant | Pas indexable par SEO |
| **Path-based `/fr/...` `/ar/...`** | SEO + propre | Refonte routing |

→ **Recommandation MVP** : cookie `NEXT_LOCALE` (rapide à intégrer,
suffisant pour le funnel checkout qui n'a pas besoin d'être indexé).

Toolkit : `next-intl` ou `react-i18next`. `next-intl` est mieux intégré
App Router.

### 5.4 Switcher UI

Pattern recommandé (non-aggressif, ergonomique) :

```
                                  ┌──────┐
                                  │ FR ▾ │
                                  └──────┘
                                    │
                              ┌─────▼─────┐
                              │  FR       │
                              │  العربية   │
                              └───────────┘
```

- Visible à chaque étape (header sticky).
- Pas de modal d'onboarding au premier chargement.
- Préserve la donnée saisie (form state ne se reset pas).

---

## 6. Lottie & thank-you pages

> Synthèse de l'agent E (recherches Lottie + neuro thank-you).

### 6.1 Pourquoi Lottie

| Format | Poids | Perf mobile | Compatible Next.js |
|---|---|---|---|
| Vidéo MP4 confetti | 800 KB – 2 MB | Lent à décoder | ✅ |
| GIF | 500 KB – 5 MB | Très lent | ✅ |
| **dotLottie** | 30–80 KB | **Excellent** | ✅ via `@lottiefiles/dotlottie-react` |
| Lottie JSON | 100–300 KB | Bon | ✅ |

→ **dotLottie** = format moderne (zip + Lottie JSON), 5–10× plus léger.

### 6.2 Stack technique

```
npm i @lottiefiles/dotlottie-react
```

```tsx
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

<DotLottieReact
  src="/animations/order-confirmed.lottie"
  autoplay
  loop={false}
  speed={1}
  style={{ width: 280, height: 280 }}
/>
```

### 6.3 Choix de l'animation

Critères pour FemiGlow :

| Critère | Exigence |
|---|---|
| Durée | 2–4 secondes, **single play** (pas de loop infini) |
| Style | Editorial, **pas** confettis tape-à-l'œil |
| Couleur | Conforme à la palette (`petale-dark`, `encre`) |
| Émotion | Calme, accueillante, féminine |
| Poids | < 80 KB |
| Reduced motion | `@media (prefers-reduced-motion)` → image statique |

→ Sources libres : **LottieFiles Free Pack** (filter "elegant flowers"),
ou commande sur mesure (~80–200€ via dribbble).

### 6.4 Structure recommandée de la page thank-you

```
┌─────────────────────────────────────┐
│                                     │
│         [Lottie animation]          │
│         (2.5s autoplay)             │
│                                     │
│   Merci, [Prénom].                  │
│   Votre kit est en route.           │
│                                     │
│   Commande #FG-2026-A3B7X           │
│   Livraison estimée 13–15 mai.      │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ ✓ Recevoir la confirmation  │   │
│   │   par email (optionnel)     │   │
│   └─────────────────────────────┘   │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ Partager le rituel ↗        │   │
│   └─────────────────────────────┘   │
│                                     │
│   « En attendant, lisez la lettre   │
│    de la maison »  → /journal       │
│                                     │
└─────────────────────────────────────┘
```

Clés psycho :

- **Lottie = clôture cognitive** (signal « c'est fait », active dopamine).
- **Nom prénom personnel** = effet cocktail party.
- **Numéro de commande visible** = trust + traçabilité.
- **Email confirmation opt-in** (et non opt-out) = compliance RGPD/09-08.
- **Lien partage / journal** = monétisation cross-sell discrète.

### 6.5 Email opt-in pattern

Si email **pas** capturé pendant le funnel (COD scenario) :

```
┌──────────────────────────────────────────┐
│ Recevoir la confirmation par email ?     │
│ (optionnel — tout fonctionne sans)       │
│ ┌────────────────────────────────────┐   │
│ │ votre.email@exemple.ma             │   │
│ └────────────────────────────────────┘   │
│ ☐ J'accepte de recevoir des actualités   │
│   FemiGlow (saison, journal).            │
│ [ Recevoir la confirmation ]             │
└──────────────────────────────────────────┘
```

- Newsletter consent = **séparé** de l'email transactionnel (compliance).
- Pré-cochage interdit (loi 09-08 art. 4).

---

## 7. DataLayer & taxonomie tracking

### 7.1 Événements GA4 ecommerce officiels (à conserver)

| Event | Quand |
|---|---|
| `view_item` | Mount `/kit` |
| `add_to_cart` | Click CTA Hero |
| `view_cart` | Mount `/panier` |
| `begin_checkout` | Click « Passer commande » |
| `add_shipping_info` | Validation step livraison |
| `add_payment_info` | Validation step paiement |
| `purchase` | Confirmation serveur |

### 7.2 Événements custom à ajouter

| Event | Trigger | Payload clé |
|---|---|---|
| `view_item` | Mount `/kit` | `currency, value, items` |
| `add_contact_info` | Validation step contact (= mini-step si funnel multi) | `currency, value, items, has_email` |
| `form_field_focus` | `onFocus` champ | `field_name, step, language` |
| `form_field_complete` | `onBlur` champ valide | `field_name, step, completion_time_ms` |
| `form_field_error` | Erreur Zod | `field_name, step, error_code, error_message` |
| `language_switch` | Click toggle FR/AR | `from_language, to_language, step` |
| `address_autocomplete_select` | Sélection dans dropdown | `selected_value, query_length, results_count` |
| `address_autocomplete_freetext` | Saisie libre validée | `freetext_value, query_length` |
| `lead_captured` | Première fois qu'un lead atteint la DB | `session_id, language, has_phone, has_email` |
| `checkout_abandonment` | `beforeunload` ou `visibilitychange` après >10s sur form sans submit | `last_step, last_field, dwell_time_ms` |
| `thankyou_animation_complete` | Lottie `onComplete` | `order_id, language` |
| `thankyou_email_optin` | Submit email opt-in | `order_id, has_consent` |

### 7.3 Export GTM

Garder la nomenclature `UPPER_SNAKE_CASE` instaurée dans `d1bac36` →
GTM Import/Export compliant. Voir `apps/web/src/lib/tracking/gtm/builders.ts`.

### 7.4 Routage par folder GTM

| Folder | Events |
|---|---|
| `CONVERSION_EVENTS` | `purchase`, `add_payment_info`, `lead_captured` |
| `ECOMMERCE_FUNNEL` | `view_item`, `add_to_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_contact_info` |
| `FORM_INTERACTIONS` | `form_field_focus/complete/error`, `address_autocomplete_*` |
| `BEHAVIOR_SIGNALS` | `language_switch`, `checkout_abandonment`, `thankyou_animation_complete` |

→ Permet d'activer/désactiver des tags GA4 / Meta Pixel par folder.

---

## 8. Compliance RGPD & loi 09-08 MA

### 8.1 Loi 09-08 (CNDP Maroc)

- **Consentement explicite** pour collecter des données perso (nom, tel, email).
- **Finalité** doit être documentée (« traitement de la commande »).
- **Pre-checked boxes interdites** pour la newsletter (art. 4).
- **Droit d'accès, rectification, opposition** doit être mentionné.
- **CNDP declaration** requise pour le traitement (à effectuer côté FemiGlow).

### 8.2 RGPD (si commande UE éventuelle)

- Consentement librement donné, spécifique, éclairé, univoque.
- **Granularité** : un consentement par finalité (transactionnel ≠ marketing).
- **Privacy policy** accessible avant la collecte.

### 8.3 Impact sur le funnel

| Élément funnel | Compliance |
|---|---|
| Capture lead step 1 (nom + tel) | Texte explicite : « pour vous rappeler en cas d'abandon ». |
| Newsletter checkbox | **Non pré-cochée** ✅ (déjà conforme). |
| Consent CGU | **Implicite à la soumission** ✅ (modèle Amazon/Stripe/Shopify). Audit trail server-side : `consented_at` + `consent_version` + `ip` + `user_agent` au `POST /finalize`. Disclaimer sous CTA : « En confirmant, vous acceptez nos CGV et politique de confidentialité ». Conforme loi 09-08 (preuve d'acceptation horodatée). |
| Email opt-in thank-you | **Non pré-coché**, opt-in actif. |
| Texte « politique de confidentialité » | Lien vers `/legal/confidentialite` à chaque collecte. |

### 8.4 Versioning du consentement

À chaque mise à jour des CGU/politique, incrémenter `consent_version`
(stocké dans le payload lead). Permet de re-solliciter en cas
d'évolution.

---

## Suite

→ `03-propositions.md` : trois directions concrètes notées sur 10.
