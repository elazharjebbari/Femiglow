# 01 — Contexte & analyse

## 1. État actuel

### 1.1 Composant et fichiers

| Fichier | Lignes | Rôle |
|---|---|---|
| `components/sections/ProductFeedSection.tsx` | 260 | Composant rendu (hero copy + 4 steps + 3 claims + social proof) |
| `lib/products/feed/kit-feed.ts` | 267 | Builder pur `buildKitProductFeed(product, content, stats)` |
| `lib/products/feed/types.ts` | — | Types `ProductFeed`, `ProductFeedStep`, `ProductFeedClaim`, `ProductFeedSocialProof` |
| `lib/products/feed/schema.ts` | — | `assertValidProductFeed` (Zod) |
| `components/commerce/CommanderAnchorButton.tsx` | — | CTA scroll-anchor vers `#commander-femiglow` |

### 1.2 Position dans le funnel `/kit`

```
Hero produit
Wizard commander           ← 1ʳᵉ zone de conversion
Composition cards
Vidéo Les gestes
Le détail INCI             ← validation rationnelle
▶ #product-feed ◀         ← TOI : 2ᵉ zone de conversion Kolenda
Comparatif vs vernis
Voix de la maison
FAQ + sticky bottom
```

C'est **le pivot final entre infos rationnelles (INCI) et déclencheur
émotionnel (témoignages + FAQ)**. La cliente passe ici si elle n'a pas
converti au 1er wizard, et c'est sa dernière chance avant que les
sections suivantes ne perdent l'intention.

### 1.3 Structure rendue actuelle

```
<section id="product-feed" bg-creme py-20 sm:py-28>
  Container width="wide"

    1. HERO (max-w-3xl center)
       ├─ Kicker "Le pack" (champagne)
       ├─ H2 display-md "Le rituel s'installe en deux gestes et un polissoir."
       ├─ Lead "Trois objets dans la main, deux gestes…"
       └─ Bloc prix (max-w-md, pt-8)
            ├─ "Tout compris : 199 MAD ~~390 MAD~~"  (flex baseline gap-3)
            ├─ <CommanderAnchorButton>Recevoir le pack</CommanderAnchorButton>
            └─ Microcopy 11 px "Paste · Powder · Polissoir…"

    2. RITUEL 4 GESTES (mt-20, grid 4 col)
       ├─ 1 Préparation (sauge) — "Préparez vos ongles"
       ├─ 2 Geste 1 (sauge) — "Appliquez la paste"
       ├─ 3 Geste 2 (pétale) — "Appliquez la powder"
       └─ 4 Polissoir Step 4 (champagne) — "Polish & Shine"

    3. CLAIMS (mt-20, border-y, grid 3 col)
       ├─ 🌿 Ingrédients d'origine naturelle
       ├─ 💧 Sans produits chimiques agressifs
       └─ ✨ Pour des ongles forts et éclatants

    4. SOCIAL PROOF (mt-16, max-w-2xl center, bg-creme-warm)
       ├─ ★★★★★ 4,8/5 · 287 avis
       ├─ Citation italique
       └─ "Lina, Rabat"
</section>
```

### 1.4 Données existantes (`ProductFeed.hero`)

| Champ | Valeur actuelle |
|---|---|
| `kicker` | « Le pack » |
| `title` | « Le rituel s'installe en deux gestes et un polissoir. » |
| `lead` | « Trois objets dans la main, deux gestes dans la soirée. La paste filme, la powder lustre, le polissoir Step 4 révèle — manucure japonaise, pensée à Rabat. » |
| `pricePrefix` | « Tout compris : » |
| `ctaLabel` | « Recevoir le pack » |
| `ctaMicrocopy` | « Paste · Powder · Polissoir Step 4 inclus · Livraison offerte au Maroc · Paiement à la livraison · Retour 30 j. » |

## 2. Lecture Kolenda — audit Pricing §4.6

### 2.1 Section dédiée §4.6 Le pack

**Objectif** : *« C'est la **deuxième zone de conversion** de la page. Tout
doit converger vers la décision. »*

**Principes activés** :

| Principe | Source |
|---|---|
| Pricing §1-15 | Toute la partie pricing |
| Attention §2 | Taille XXL du prix |
| Ecommerce §14 | Densité du deal |
| Color §1, §5 | Pop chaud local autorisé sur l'« Économie » |
| Copywriting §6, §13 | Mots positifs collés, rôle « initiée » |

### 2.2 Table d'audit — 14 recommandations §4.6

| # | Recommandation | État actuel | Verdict |
|---|---|---|---|
| K1 | Layout **serré** (Ecommerce §14) | `py-20 sm:py-28` + `mt-20` + `mt-16` → très aéré | **⚠️ Trop aéré** |
| K2 | Eyebrow `LE PACK` | ✅ Kicker champagne | OK |
| K3 | H2 « Le rituel s'installe… » | ✅ Présent | OK |
| K4 | **Visuel pack packshot** | ❌ Aucune image dans la section | **🔴 Manquant** |
| K5 | **« Valeur séparée »** micro-liste (Paste 110 + Powder 90 + Polissoir 120 → 320 MAD) | ❌ Absent | **🔴 Manquant** |
| K6 | Bloc prix horizontal, espace généreux (Mueller-Lyer, Pricing §2) | ⚠️ Horizontal OK, `gap-3` étroit | ⚠️ Sous-utilisé |
| K7 | Barré 60 % du courant (Pricing §1) | ⚠️ `text-3xl` vs `text-base` = ~50 % mais barré reste lisible | ⚠️ Partiel |
| K8 | **« Économie 191 MAD »** terracotta (Color §1 + Pricing §6) | ❌ Absent | **🔴 Manquant** |
| K9 | **Reframing valeur d'usage** « ≈ 1,5 MAD/manucure · 8 séances salon = 1 200 MAD/an » (Pricing §7-8) | ❌ Absent | **🔴 Manquant** |
| K10 | CTA `Commander le rituel` en sauge profond `#4A5D4A` | ⚠️ Label = « Recevoir le pack », couleur = `bg-encre` noir | ⚠️ Pas sauge |
| K11 | Trust row sous CTA | ✅ Microcopy 11 px présente | OK |
| K12 | **Bandeau avis** `★ 4,8/5 · 287 femmes — Rabat, Casablanca, Marrakech` (Copywriting §11) | ⚠️ « 287 avis » au lieu de « 287 femmes », pas de géographie | ⚠️ À ajuster |
| K13 | Sous-bloc Étapes du rituel | ✅ 4 cards numérotées | OK |
| K14 | Numéros uniformes or poudré `#B8956B` | ⚠️ Multi-couleurs 1/2 sauge, 3 pétale, 4 champagne | ⚠️ Décision design assumée |

**Score Kolenda §4.6** : **5/14 OK · 5/14 à ajuster · 4/14 manquants**.

### 2.3 Principes Pricing §3.7 manqués (impact direct)

| # | Principe Kolenda | Lecture actuelle | Application possible |
|---|---|---|---|
| Pr §1 | Anchoring prix barré différencié | Barré = encre/45 line-through, mais pas à 60 % taille du courant | Forcer `text-sm` (~60 % de `text-5xl`) sur barré |
| Pr §2 | Espace horizontal entre prix (Mueller-Lyer) | `gap-3` = 12 px | Augmenter à `gap-6` minimum |
| Pr §6 | **Économie absolue > %** | « 191 MAD » non affiché — ligne entière manquante | Ajouter ligne terracotta |
| Pr §7 | **Reframing valeur d'usage** | Absent | Ajouter ligne 13-14 px encre/70 |
| Pr §8 | **Comparaison de valeur** salon vs FemiGlow | Absent | Coupler à Pr §7 |
| Pr §10 | « Petits mots » à côté du prix | « Tout compris : » en kicker — bien | Garder |
| Pr §14 | **Grand nombre près du prix** | « 287 avis » en bas, distant du prix | Rapprocher visuellement |
| Pr §15 | **Valeur séparée listée** | Absent | Ajouter micro-liste avant prix |

### 2.4 Autres principes activés mais sous-exploités

| Discipline | Principe | État actuel |
|---|---|---|
| Attention §2 | Prix 3-4× body | `text-3xl` = 30 px ≈ 1,9× body 16 px. **Sous le ratio.** |
| Attention §3 | Micro-pulse CTA `scale 1.02` 3-4 s | Pas implémenté |
| Color §1 | Pop chaud unique | Section 100 % froide — l'« Économie » terracotta est ratée |
| Copywriting §13 | Rôles permanents > actions | « Recevoir le pack » = verbe d'action. Kolenda : **« Commander le rituel »** |

## 3. Forces & faiblesses

### 3.1 Forces à préserver

| # | Force | Pourquoi |
|---|---|---|
| F1 | **Voix maison sobre** dans tous les textes — pas de superlatif, présent + verbes sensoriels | Cohérent Luxury §2-4 + Copy §1 |
| F2 | **Rituel 4 cards** structuré avec pastilles colorées | Active *imaginabilité* (Copy §15) |
| F3 | **3 claims** pictos discrets + détail | Ecommerce §14 densité visuelle |
| F4 | **Social proof** condensé : note + nombre + citation + auteur | Ecommerce §8-9 (4,8 > 5,0) |
| F5 | **Microcopy trust row** sous CTA | Copy §6 mots positifs collés |
| F6 | **`CommanderAnchorButton`** scroll-anchor (pas de redirect) | UX §9 frequent interactions |
| F7 | **Anti-patterns évités** : countdown, -49 %, format prix conforme | Luxury §10-11 |

### 3.2 Faiblesses critiques

| # | Faiblesse | Impact conversion | Gravité |
|---|---|---|---|
| W1 | Pas d'« Économie 191 MAD » terracotta (Pricing §6 + Color §1) | -8 à -12 % mémorisation gain, **levier #1 conversion manqué** | **🔴 Bloquant** |
| W2 | Pas de reframing valeur d'usage (Pricing §7-8) | Prix paraît « cher » dans l'absolu | **🔴 Bloquant** |
| W3 | Pas de valeur séparée (Pricing §15) | Anchoring haut raté | **🔴 Majeur** |
| W4 | Pas de packshot dans la section | Attention §4 dynamic imagery raté | **🔴 Majeur** |
| W5 | Prix `199` trop petit (Attention §2) | Ratio 1,9× au lieu de 3-4× body | **🟠 Important** |
| W6 | CTA label + couleur non conformes | Copy §13 + Color §1 ratés | **🟠 Important** |
| W7 | « 287 avis » au lieu de « 287 femmes · géographie » | Self-relevance Attention §10 perdue | **🟠 Important** |
| W8 | Social proof éloignée du CTA (`mt-16`) | Pricing §14 grand nombre près du prix raté | **🟠 Important** |
| W9 | Layout trop aéré | Ecommerce §14 — densité = « affaire » | **🟡 Mineur** |
| W10 | Pas de micro-pulse CTA | Attention §3 motion onset raté | **🟡 Mineur** |
| W11 | Pas de reveal animation steps/claims | Manque rythme Luxury §7 slow motion | **🟡 Mineur** |

## 4. Hypothèses conversion

Si on corrige W1 + W2 + W3 + W4 + W6 :

| H | Mécanisme | Impact estimé |
|---|---|---|
| H1 | Économie 191 MAD terracotta = pop chaud + chiffre absolu mémorisé | +5 à +8 % CTR CTA |
| H2 | Reframing « 1,5 MAD/manucure · 1 200 MAD/an salon » | +3 à +5 % conversion (réduit objection prix) |
| H3 | Valeur séparée 320 MAD = anchoring haut renforcé | +2 à +4 % « bon deal » perçu |
| H4 | Packshot 3 produits = focal visuel Attention §4 | +3 à +5 % engagement |
| H5 | CTA sauge + micro-pulse + « Commander le rituel » | +4 à +6 % click rate |

**Conversion totale estimée** : **+10 à +18 %** CTR CTA, **+5 à +9 %**
conversion finale attribuable à ce bloc.

## 5. Risques projet

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Asset packshot DA non livré à temps | Moyen | Important | Réutiliser `/products/kit-principale.svg` déjà rendu sur cover vidéo (existant) |
| Reveal animations désactivées par `prefers-reduced-motion` | Très probable | Mineur | Pattern `Reveal` existant déjà respectueux (cf. phase composition) |
| Micro-pulse CTA jugée distrayante à l'usage | Faible | Mineur | Tester sur 1 j en preview avant prod, kill-switch CSS |
| Conflit avec sticky CTA bottom-mobile (double CTA) | Moyen | Moyen | Position scroll : sticky disparaît quand `#product-feed` CTA visible |
| Override admin singleton conflit avec feed Merchant XML | Faible | Important | Le builder reste pur, l'override n'affecte que le rendu UI |
| Régression sur tests `kit-feed` existants (ProductFeed shape) | Moyen | Moyen | Champs additifs uniquement, rétro-compat strict |

## 6. Décisions à figer avant le go

| Décision | Options | Recommandation |
|---|---|---|
| Couleur « Économie » terracotta | A) `#C28A6E` Kolenda · B) Autre teinte chaude | **A** — directement cité Kolenda |
| Reframing valeur — 1 ou 2 lignes ? | A) 1 ligne dense « ≈ 1,5 MAD/manucure · 1 200 MAD/an salon » · B) 2 lignes séparées | **A** — densité signale « affaire » |
| CTA couleur | A) Sauge profond `#4A5D4A` Kolenda · B) Conserver `bg-encre` actuel | **A** — Color §1 |
| CTA micro-pulse | A) Toujours actif (motion-safe) · B) Hover-only · C) Pas du tout | **A** — Attention §3 motion onset |
| Packshot source | A) `/products/kit-principale.svg` existant · B) Nouvel asset DA | **A** — pas de blocage DA |
| Admin override singleton ou multi-instance ? | A) Singleton 1 entrée · B) Multi (variants A/B futures) | **A** — scope contained, A/B backlog |
