# 02 — Vision & objectifs

## 1. Vision

> *Transformer un bloc d'info structuré en **décision évidente** : la
> cliente voit le prix, comprend ce qu'elle gagne, ramène l'achat à un coût
> par usage, et trouve le CTA sous son pouce.*

La section devient **la deuxième zone de conversion** de la page (cf.
Kolenda §4.6) — densifiée, chaude au bon endroit (Économie terracotta),
contextualisée par l'usage, ancrée par une preuve sociale géographique
adjacente au CTA.

## 2. Personae cibles

| Persona | Comportement attendu | Levier |
|---|---|---|
| **Imane, 28 ans, Rabat** — décide vite | Voit le prix, calcule « ≈ 1,5 MAD/manucure », clique CTA en 5 s | **Reframing usage** + CTA sauge |
| **Salma, 34 ans, Casablanca** — compare au salon | Voit « 1 200 MAD/an de salon » → contraste 199 MAD → bascule | **Comparaison de valeur** Pricing §8 |
| **Khadija, 41 ans, Marrakech** — premium-sensible | Voit « Économie 191 MAD » + valeur séparée → sentiment « bon deal » | **Économie absolue** + **valeur séparée** Pricing §6+15 |
| **Amal, 22 ans, Tanger** — mobile-only | Scroll rapide ; le micro-pulse CTA capte l'œil + bandeau social proof adjacent | **Motion onset** Attention §3 + CTA position |

## 3. Objectifs métier

### 3.1 KPIs primaires (mesurables analytics)

| KPI | Baseline | Cible 30 j | Cible 90 j |
|---|---|---|---|
| **CTR « Commander le rituel »** depuis `#product-feed` | ~6 % | ≥ 8 % | **≥ 10 %** |
| **Conversion attribuable** à la section | ~12 % | ≥ 14 % | **≥ 16 %** |
| **Temps moyen** sur section (mobile) | ~8 s | ≥ 12 s | **≥ 14 s** |
| **Scroll-through** section → comparatif | ~62 % | ≥ 68 % | **≥ 72 %** |
| **Vue social proof** (% qui voit le bandeau) | ~45 % | ≥ 60 % | **≥ 70 %** (rapprochement CTA) |

### 3.2 KPIs secondaires (qualité)

| KPI | Cible |
|---|---|
| Lighthouse Performance `/kit` mobile | ≥ 92 (préservé) |
| LCP `/kit` mobile | ≤ 2,5 s |
| CLS `/kit` mobile | ≤ 0,1 |
| Axe sérieuse/critique sur `#product-feed` | **0 violation** |
| Bundle size delta `/kit` (gzip) | ≤ +5 kB (packshot SVG inline ~3 kB déjà chargé) |
| Couverture tests `lib/kit/pack/**` | ≥ 90 % branches |
| Couverture tests `components/sections/ProductFeedSection*` | ≥ 85 % branches |

## 4. Hypothèses conversion

| # | Hypothèse | Mécanisme Kolenda | Mesure |
|---|---|---|---|
| H1 | Économie terracotta absolue mémorisée | Pricing §6 + Color §1 pop chaud unique | Compter clics CTA vs vue économie (eye-tracking proxy via scroll depth) |
| H2 | Reframing usage réduit l'objection prix | Pricing §7-8 reframing valeur d'usage | Mesurer temps avant clic CTA |
| H3 | Valeur séparée renforce l'anchoring | Pricing §15 valeur séparée listée | Sondage post-achat : « avez-vous trouvé le prix bon marché ? » |
| H4 | Packshot capte l'œil et arrête le scroll | Attention §4 dynamic imagery | Scroll-depth + temps moyen |
| H5 | CTA sauge profond + micro-pulse + label rôle | Color §1 + Attention §3 + Copy §13 | CTR mesuré directement |
| H6 | Social proof géographique = self-relevance | Attention §10 self-relevance | Vue social proof / vue CTA ratio |

## 5. Garde-fous

### 5.1 Non-régression fonctionnelle

| Garde-fou | Vérification |
|---|---|
| Tous les textes existants `ProductFeed.hero/steps/claims/socialProof` rétro-compat | Vitest snapshot `kit-feed.test.ts` |
| 4 step cards toujours rendues avec accent colors | Test snapshot `ProductFeedSection` |
| 3 claims toujours rendus avec pictos SVG | Test snapshot |
| `CommanderAnchorButton` scroll vers `#commander-femiglow` | Test E2E `@pack-interaction` |
| Microcopy trust row préservée | Snapshot |
| Feed XML Merchant intact (`assertValidProductFeed`) | Test `kit-feed.test.ts` |

### 5.2 Non-régression performance

| Garde-fou | Cible |
|---|---|
| `/kit` LCP mobile | ≤ 2,5 s |
| Bundle `chunks/kit-*.js` | delta ≤ +5 kB gzip |
| Hydration mismatch | 0 (test E2E console) |
| Pas de nouvelle dépendance > 5 kB | strict |

### 5.3 Non-régression Kolenda

| Garde-fou | Source |
|---|---|
| Une seule couleur chaude sur la section (économie terracotta) | Color §1 |
| Pas de « -49 % » sticker | Pricing anti-pattern §16 |
| Pas de countdown | Luxury §11 |
| Format prix `199 MAD` (pas `199,00`) | Pricing §3 |
| Pas d'animation snappy < 200 ms | Attention §3 |
| Pas de FAQ défensive | Luxury §11 |

## 6. Définition du « done »

La refonte est **livrée** quand :

1. **Phases 0-6 mergées sur `master`**, chaque phase verrouillée par son gate.
2. **Tous les KPIs primaires cibles 30 j** atteints.
3. **Aucune régression** détectée sur les KPIs secondaires.
4. **Documentation à jour** : `components/kit/README.md` étendu avec la section pack.
5. **Un éditeur non-dev** a publié une modification via `/admin/kit/pack` en < 60 s sans aide.

## 7. Couche analytique

### 7.1 Events nouveaux à émettre

| Event | Quand | Params |
|---|---|---|
| `pack_section_view` | IntersectionObserver 0.5 sur la section | `section_id='product-feed'`, `price_cents`, `currency` |
| `pack_cta_click` | Click sur `CommanderAnchorButton` | `product_id`, `cta_label`, `price_cents`, `from_section='product-feed'` |
| `pack_economy_view` | IntersectionObserver 0.8 sur la ligne « Économie 191 MAD » | `savings_amount`, `currency` |
| `pack_social_proof_view` | IntersectionObserver 0.5 sur le bandeau avis | `rating`, `reviews_count` |

### 7.2 Events existants à préserver

`view_item` (déjà émis par `CommanderAnchorButton`), `add_to_cart` proxy au scroll vers wizard.

## 8. Calendrier

| Phase | Semaine | Durée |
|---|---|---|
| 0 — Quick wins Pricing | S1 lundi | 0,5 j |
| 1 — CTA refonte | S1 mardi matin | 0,25 j |
| 2 — Social proof | S1 mardi après-midi | 0,25 j |
| 3 — Packshot + reveal | S1 mercredi | 1 j |
| 4 — Admin éditeur | S1 jeudi | 0,75 j |
| 5 — E2E Playwright + axe | S1 vendredi matin | 0,5 j |
| 6 — Handoff + cleanup | S1 vendredi après-midi | 0,25 j |

**Buffer** : 0,5 j supplémentaire prévu en début S2 pour ajustements DA / contenus.
