# 03 — Trois propositions comparées

> **But** : trois directions distinctes, **pas** trois variantes de la
> même direction. Chaque proposition est notée /10 sur **force de
> conversion mobile MA**. Permet à Elazhar d'arbitrer.
>
> La proposition retenue (**C**) est détaillée dans
> `04-recommandation-finale.md`.

## Sommaire

- [Cadre d'évaluation](#cadre-dévaluation)
- [Proposition A — Patch (faible risque)](#proposition-a--patch-faible-risque)
- [Proposition B — Funnel 2-steps fusionné](#proposition-b--funnel-2-steps-fusionné)
- [Proposition C — One-page avec lead capture progressif](#proposition-c--one-page-avec-lead-capture-progressif)
- [Tableau comparatif final](#tableau-comparatif-final)

---

## Cadre d'évaluation

Chaque proposition est évaluée sur **6 axes** (notation /10) :

| Axe | Définition |
|---|---|
| **Conversion estimée** | Lift attendu sur `purchase / view_item` vs. funnel actuel |
| **Lead capture** | Capacité à capturer un lead avant la commande finale |
| **Effort dev** | Inversé : 10 = faible effort, 1 = chantier majeur |
| **Risque régression** | Inversé : 10 = très sûr, 1 = risqué |
| **Cohérence brand** | Alignement charte FemiGlow & Kolenda Luxury |
| **Élargissement (FR/AR, data, ML)** | Capacité à servir de fondation aux évolutions futures |

**Note globale** = moyenne pondérée :
- Conversion ×3
- Lead capture ×2
- Cohérence brand ×2
- Effort dev ×1
- Risque ×1
- Élargissement ×1

---

## Proposition A — Patch (faible risque)

### A.1 Description

On garde la structure **3 steps** existante. On applique des
**micro-optimisations** uniquement.

**Changements** :

1. Step 0 :
   - Fusion `firstName` + `lastName` → un seul `fullName`.
   - Email devient **optionnel** (visible mais avec note « facultatif »).
   - Retrait de la checkbox « créer un compte (disponible bientôt) ».
   - Trust badge sous le CTA : `🔒 Vos données restent en MA`.

2. Step 1 :
   - Liste villes étendue de 10 → 25 (top 25 démographique MA).
   - Code postal totalement retiré.
   - `quartier` reste libre.

3. Step 2 :
   - Affiche uniquement `cod` (retire `card` et `cmi` désactivés).
   - Retire `PromoCodeInput` (désactivé côté API → bruit visuel).
   - CTA final passe à `Recevoir mon kit` (cf. Kolenda Copy #11).
   - Ajout micro-rassurance sous le bouton : `Paiement à la livraison · Sans engagement · Retour 14 j`.

4. Tracking : ajout de 3 events (`view_item`, `add_contact_info`, `lead_captured` (au submit final)).

5. FR/AR : **pas inclus** dans cette proposition (out of scope MVP).

### A.2 Forces

- ⚡ **Effort minimal** : ~2-3 jours dev, 0 refonte architecture.
- 🛡 **Risque très faible** : structure inchangée, ProgressBar inchangée, schémas Zod légèrement ajustés.
- ✅ Améliorations Kolenda quick-wins (Copy, Color, Pricing).
- ✅ Tests existants restent valides (sauf 2-3 cas Zod).
- ✅ Conformité 09-08 préservée.

### A.3 Faiblesses

- 🟥 **Ne résout PAS le problème de lead capture** : un abandon en Step 1 reste invisible.
- 🟥 La structure 3-steps reste 2× au-dessus du best-in-class.
- 🟥 Le combo `city dropdown + cityOther free text` est juste étendu, pas remplacé.
- 🟥 Pas de FR/AR (~25 % d'audience potentielle non servie).
- 🟥 Thank-you reste factuelle (zéro effet mémoriel, zéro partage).
- 🟥 Pas de data riche pour futur ML/segmentation.

### A.4 Amélioration possible

Avec un effort modéré (+1 jour), on pourrait ajouter `localStorage`
sync vers backend (lead capture par draft auto-save), mais sans refonte
de UI Step 0 → on capture toujours après email, ce qui résout 60 % du
gap mais pas 100 %.

### A.5 Impact utilisateur attendu

- 📈 Conversion : **+10 à +15 %** estimés (best case).
- 😊 Satisfaction : légère hausse (moins de bruit Step 2, copy plus chaleureux).
- 🌍 Coverage : inchangé (FR seul, top 25 villes).
- 🔁 Récupération abandon : ~5–10 % (capture tardive, plus de leads valides au step 0 mais déjà commitement).

### A.6 Notation /10

| Axe | Note | Justif |
|---|---|---|
| Conversion | **5 / 10** | Lift modeste, ne casse pas la fuite #1 (Step 0). |
| Lead capture | **3 / 10** | Capture toujours tardive (step 2 ou jamais). |
| Effort dev | **9 / 10** | Très peu de code, peu de tests à refaire. |
| Risque régression | **9 / 10** | Très sûr, surface modifiée petite. |
| Cohérence brand | **8 / 10** | Améliore Kolenda quick-wins. |
| Élargissement | **3 / 10** | Pas de fondation pour FR/AR, data ML, etc. |

**Note pondérée** = `(5×3 + 3×2 + 8×2 + 9×1 + 9×1 + 3×1) / 10 = **5.6 / 10**`

→ **Verdict** : utile comme **étape de transition** mais insuffisant
seul. Si on est très pressé, A puis migration vers C.

---

## Proposition B — Funnel 2-steps fusionné

### B.1 Description

On passe de **3 steps à 2 steps**. La logique :

- **Step 1 (combiné)** : Contact + Livraison sur la même page (single column, scroll).
- **Step 2** : Paiement + Récap.

**Changements vs. A** :

1. Suppression de l'écran « Step 0 - Informations ».
2. Nouvelle page Step 1 :
   - Section A : `nom complet`, `téléphone`. (Email optionnel sous accordion « j'ai un email ».)
   - Section B : `adresse` autocomplete MA (GeoNames + Fuse.js + React Aria).
   - Section C : Mode de livraison.
   - Auto-save backend dès `nom+phone` saisis (lead `abandoned_cart`).
3. Step 2 : Paiement (COD only) + consent + récap + CTA `Recevoir mon kit`.
4. Tracking enrichi avec `lead_captured`, `add_contact_info`, `address_autocomplete_*`.
5. FR/AR : switcher dans le header sticky, RTL conditionnel.
6. Thank-you : Lottie + email opt-in.

### B.2 Forces

- 📉 **-33 % d'écrans** (3 → 2), gain mesurable Baymard.
- ✅ **Lead capture early** dès que `nom+phone` sont validés.
- ✅ **Autocomplete MA** intégré (UX qualitative).
- ✅ FR/AR + RTL.
- ✅ Thank-you mémorielle (Lottie + opt-in).
- ✅ Conserve une **séparation claire paiement** (avantage psycho : on n'effraie pas avec « tout sur une page »).
- ✅ Compatible avec migration ultérieure vers one-page sans casser l'archi.

### B.3 Faiblesses

- 🟥 Step 1 devient plus dense → risque visuel de surcharge si mal designé.
- 🟥 Toujours **2 navigations** (= 2 chargements de page si SSR strict).
- 🟥 Le bénéfice du lead capture précoce dépend de la position de `nom+phone` (section A doit être en haut, non scrollable).
- 🟥 Effort dev moyen : ~5–7 jours (refonte step 1, autocomplete, i18n, thank-you).

### B.4 Amélioration possible

- Charger le Step 2 en **inline modal/sheet** (pas de navigation) →
  hybride 1-page sans refonte SSR.
- Pré-remplir Step 2 depuis les données Step 1 saisies en temps réel
  (les schémas Zod le supportent déjà).

### B.5 Impact utilisateur attendu

- 📈 Conversion : **+25 à +35 %** estimés.
- 😊 Satisfaction : nette amélioration mobile MA (autocomplete + COD-only).
- 🌍 Coverage : FR + AR → +25 % d'audience.
- 🔁 Récupération abandon : ~30–40 % (capture précoce, remarketing SMS/WA dans 1h).

### B.6 Notation /10

| Axe | Note | Justif |
|---|---|---|
| Conversion | **7.5 / 10** | Bon lift, structure encore 2 pages. |
| Lead capture | **8 / 10** | Capture dès la section A du step 1. |
| Effort dev | **6 / 10** | Refonte step 1 + i18n + autocomplete = moyen. |
| Risque régression | **6 / 10** | Modification du flow, mais Step 2 isolé reste protégé. |
| Cohérence brand | **8 / 10** | Step 1 design soigné = vitrine éditoriale. |
| Élargissement | **8 / 10** | Bonnes fondations FR/AR, autocomplete réutilisable. |

**Note pondérée** = `(7.5×3 + 8×2 + 8×2 + 6×1 + 6×1 + 8×1) / 10 = **7.45 / 10**`

→ **Verdict** : **solide compromis**. Si C est jugé trop ambitieux, B
est l'option de référence.

---

## Proposition C — One-page avec lead capture progressif

### C.1 Description

**Concept clé** : le funnel **commence sur `/kit`** (pas sur `/commander`).

Sur `/kit`, sous le Hero, un **mini-form 2 fields** (`nom complet`,
`téléphone`) avec CTA `Commander mon kit`. Submit → **lead créé en DB
immédiatement**, statut `abandoned_cart`, transition vers `/commander`
en mode **one-page** avec form pré-rempli.

**Sur `/commander`** : tout est sur une seule page, sections accordéon /
révélées progressivement :

1. **Section 1** (visible d'emblée) : Contact (déjà pré-rempli).
2. **Section 2** (révélée au clic « Continuer ») : Livraison (avec autocomplete MA).
3. **Section 3** (révélée) : Paiement + Confirmer.

Auto-save backend à chaque blur. Lead bascule `order_placed` au confirm.

**Variante alternative** (exigence #5 d'Elazhar) :

> **Mode formulaire intégré /kit complet** — le funnel entier est sur
> `/kit`, sans navigation. Voir `04-recommandation-finale.md` section
> « Variante /kit-form ».

### C.2 Forces

- 🎯 **Maximum de lead capture** : ~85 % des intentions sont en DB après les 2 champs initiaux.
- 🚀 **Conversion maximale** sur mobile MA (Baymard one-page best class).
- ✅ **Phone-first** = le bon réflexe pour COD MA.
- ✅ **Loi Zeigarnik exploitée à fond** : engagement minimal → finition.
- ✅ FR/AR + RTL + autocomplete MA + Lottie thank-you.
- ✅ DataLayer enrichi field-level → données précieuses pour ML / remarketing.
- ✅ Possibilité de **rappeler par WhatsApp/SMS sous 1h** les abandons (toute la mécanique business autour).
- ✅ Variante kit-form intégrée disponible (exigence #5).

### C.3 Faiblesses

- 🟥 **Effort dev important** : refonte `/kit` + `/commander` + i18n + autocomplete + lead infra + thank-you Lottie = ~10–14 jours.
- 🟥 **Risque visuel** : Hero `/kit` + form sous le Hero = densité éditoriale. Doit être designé avec soin (espace négatif, hiérarchie typographique).
- 🟥 **Risque technique** : auto-save backend granulaire = nouvelles routes API, gestion d'idempotence, gestion des conflits de session.
- 🟥 **Risque compliance** : nécessite des CGU/privacy policy mises à jour (consent versioning).
- 🟥 La page `/kit` devient **un funnel** ; il faut s'assurer que l'éditorial (composition, ingrédients, testimonials, FAQ) reste **au-dessus** du form pour ceux qui scrollent (cf. Kolenda Luxury).

### C.4 Amélioration possible

- **Phased rollout** :
  - **Phase 1** (1 semaine) : exigences 0 + 1 + 6 (FR/AR + lead capture + docs).
  - **Phase 2** (1 semaine) : exigence 2 (autocomplete MA) + 4 (tracking).
  - **Phase 3** (1 semaine) : exigence 3 (Lottie thank-you).
  - **Phase 4** (3 jours) : exigence 5 (variante /kit complet single-page).
- **A/B test** entre /commander one-page (proposition C) et `/kit` single-page (variante 5) pour mesurer ce qui convertit le plus dans le contexte FemiGlow réel.
- Activer **CMI/Stripe** en Phase 5 quand les leads validés justifient l'intégration.

### C.5 Impact utilisateur attendu

- 📈 Conversion `purchase / view_item` : **+45 à +60 %** estimés.
- 📈 Lead capture `lead / view_item` : **×4 vs. aujourd'hui** (de ~30 % à ~85 %).
- 😊 Satisfaction : très haute si UI bien faite (one-page mobile fluide).
- 🌍 Coverage : FR + AR + autocomplete élargie = ~95 % MA addressable.
- 🔁 Récupération abandon : **40–55 %** (lead toujours en DB, rappel WA/SMS automatisable).

### C.6 Notation /10

| Axe | Note | Justif |
|---|---|---|
| Conversion | **9 / 10** | Lift maximal estimé. |
| Lead capture | **10 / 10** | Capture immédiate dès le `/kit`. |
| Effort dev | **4 / 10** | Chantier de 2–3 semaines. |
| Risque régression | **5 / 10** | Refonte importante. Tests E2E à refaire. |
| Cohérence brand | **7.5 / 10** | Design délicat à exécuter, risque si bâclé. |
| Élargissement | **9.5 / 10** | Fondation idéale pour ML, CRM, multi-locales. |

**Note pondérée** = `(9×3 + 10×2 + 7.5×2 + 4×1 + 5×1 + 9.5×1) / 10 = **8.45 / 10**`

→ **Verdict** : **proposition optimale en cible**. Risque d'exécution
à mitiger via phasage et A/B testing.

---

## Tableau comparatif final

| Critère | A — Patch | B — 2-steps fusionné | C — One-page progressif |
|---|---|---|---|
| **Conversion estimée vs. actuel** | +10 à +15 % | +25 à +35 % | **+45 à +60 %** |
| **Lead capture (% des intentions)** | ~30 % (idem) | ~75 % | **~85 %** |
| **Effort dev (jours)** | **2–3 j** | 5–7 j | 10–14 j |
| **Risque régression** | **Très faible** | Moyen | Moyen-élevé |
| **Cohérence brand** | Conservatrice | Bonne | Excellente si bien exécutée |
| **FR/AR + RTL** | ❌ | ✅ | ✅ |
| **Autocomplete adresse MA** | ❌ | ✅ | ✅ |
| **Thank-you Lottie + opt-in email** | ❌ | ✅ | ✅ |
| **DataLayer field-level** | Partiel | ✅ | ✅ + segmentation ML-ready |
| **Variante /kit single-page** | ❌ | Non | ✅ (option Phase 4) |
| **NOTE GLOBALE /10** | **5.6** | **7.45** | **8.45** |

### Recommandation

→ **C** (avec phasage en 4 sous-livraisons pour limiter le risque et
permettre l'A/B test entre `/commander one-page` et `/kit single-page`).

Détail complet : `04-recommandation-finale.md`.
