# 02 — Vision & objectifs

## 1. Vision

> *Transformer une table technique en fiche d'atelier respirée : la cliente
> apprend, doute moins, et retombe naturellement sur le pack.*

La section devient le **lieu de la transparence sereine** : la maison y
dit ce qu'elle met dans ses pots, **comme une artisane qui parle de son
atelier**. Pas d'effet de manche scientifique, pas de jargon non-décodé,
pas de scroll forcé.

## 2. Personae cibles

| Persona | Comportement attendu | Besoin |
|---|---|---|
| **Imane, 28 ans, Rabat** — cliente premium, lit tout avant d'acheter | Ouvre les 3 accordéons, lit les origines, vérifie les certifications | Validation rationnelle du sérieux |
| **Salma, 34 ans, Casablanca** — pressée mais sceptique | Ouvre 1 sous-produit, lit la première ligne du tableau, scrolle vers le pack | Décode jargon en un tap (tooltip) |
| **Khadija, 41 ans, Marrakech** — soucieuse halal | Vérifie les certifications, lit les origines, valide « ingrédients naturels » | Certifications visibles + origines précises |
| **Amal, 22 ans, Tanger** — mobile-only, scroll rapide | Effleure la section, voit l'accordéon, clique sur 1 ingrédient pour le tooltip | Pas de friction, navigation rapide |

## 3. Objectifs métier

### 3.1 KPIs primaires (mesurables via analytics)

| KPI | Baseline (estimée) | Cible 30 j | Cible 90 j |
|---|---|---|---|
| **Temps moyen** sur section (mobile) | ~12 s | ≥ 20 s | **≥ 25 s** |
| **Scroll-through** section → `#commander-femiglow` | ~55 % | ≥ 65 % | **≥ 70 %** |
| **Taux d'ouverture accordion** (mobile, ≥ 1 déplié) | n/a | ≥ 35 % | **≥ 40 %** |
| **Taux de clic tooltip INCI** | n/a | ≥ 10 % | **≥ 15 %** |
| **Clic « ↓ Voir le pack »** depuis section | 0 (n'existe pas) | ≥ 6 % | **≥ 8 %** |
| **Bounce sur section** (sortie immédiate < 3 s) | inconnu | ≤ 15 % | **≤ 10 %** |

### 3.2 KPIs secondaires (qualité)

| KPI | Cible |
|---|---|
| Lighthouse Performance score `/kit` | ≥ 92 (mobile), ≥ 95 (desktop) |
| LCP `/kit` mobile | ≤ 2,5 s |
| CLS `/kit` mobile | ≤ 0,1 |
| Axe sérieuse/critique sur `section#ingredients-details` | **0 violation** |
| Bundle size delta `/kit` (gzip) | ≤ +6 kB total |
| Couverture tests `lib/kit/composition/**` | ≥ 90 % branches |
| Couverture tests `components/commerce/Ingredient*` | ≥ 85 % branches |

## 4. Hypothèses de conversion

| Hypothèse | Mécanisme | Mesure |
|---|---|---|
| H1 — **Accordéon mobile** réduit la fatigue scroll | UX §7 Hide unnecessary | Mesurer scroll-depth + temps avant exit |
| H2 — **Tooltip INCI** décode jargon, retire le doute | Copywriting §14 + Luxury §6 | Compter clics tooltip × paramètre `inci_term` |
| H3 — **Intro narrative voix maison** reconnecte au ton | Luxury §6 fiche d'atelier | Heatmap sur intro (eye-tracking proxy) |
| H4 — **Cards mobile verticales** suppriment le scroll horizontal | UX §1 ≤ 4 colonnes percues | Comparer interactions tableau vs cards |
| H5 — **Bouton retour pack** ferme la boucle conversion | Attention §12 directional words | Conversion-from-section attribuable |

## 5. Garde-fous

### 5.1 Non-régression fonctionnelle

| Garde-fou | Type | Vérification |
|---|---|---|
| Tableau desktop conserve les 5 colonnes complètes | UX | Vitest + Playwright desktop |
| Tous les ingredients du mock affichés (aucun perdu en refactor) | Data | Vitest snapshot |
| Anchors `#ingredients-details-{id}` préservés | SEO | Test unit |
| `role="region"` + `aria-label` toujours présent | A11y | Axe + test snapshot |
| Certifications affichées avec label + body | Data | Vitest |

### 5.2 Non-régression performance

| Garde-fou | Cible |
|---|---|
| `/kit` LCP mobile | ≤ 2,5 s (baseline préservée) |
| Bundle `chunks/kit-*.js` | delta ≤ +6 kB gzip |
| Hydration mismatch | 0 (test E2E console) |
| Pas de chargement bloquant en JS supplémentaire | Pas de nouvelle lib > 5 kB |

### 5.3 Non-régression Kolenda

| Garde-fou | Source |
|---|---|
| Pas de rouge sur la section | Color §8 |
| Pas de couleur chaude (réservée bloc prix) | Color §1 |
| Pas de FAQ défensive | Luxury §11 |
| Pas de logos certifications XXL | §4.5 |
| Pas de « 100 % » vide | Copywriting §12 |
| Pas d'animation < 200 ms | Attention §3 |

## 6. Définition du « done »

La refonte est **livrée** quand :

1. **Phases 0-7 mergées sur `master`**, chaque phase verrouillée par son
   gate (cf. doc 08).
2. **Tous les KPIs primaires cibles 30 j** atteints (mesurés J+30
   post-déploiement).
3. **Aucune régression** détectée sur les KPIs secondaires.
4. **Documentation à jour** : `components/kit/README.md` étendu avec
   la section ingrédients refondue.
5. **Un éditeur non-dev** a publié une modification via
   `/admin/kit/composition/[id]` en < 60 s sans aide.

## 7. Couche analytique

### 7.1 Events nouveaux à émettre

| Event | Quand | Params |
|---|---|---|
| `composition_accordion_open` | Au déploiement d'un sous-produit accordéon | `sub_product_id`, `sub_product_name` |
| `composition_inci_tooltip_open` | Au tap/hover sur une icône ⓘ INCI | `sub_product_id`, `inci_term` |
| `composition_post_cta_click` | Au clic sur « ↓ Voir le pack » sous un sous-produit | `sub_product_id`, `target='#commander-femiglow'` |
| `composition_narrative_view` | À l'apparition de l'intro narrative dans le viewport (IntersectionObserver) | `sub_product_id` |

### 7.2 Events existants à préserver

Aucun. La section n'avait pas de tracking actif jusqu'ici.

### 7.3 Dimensions GA4 dérivées

- **`composition_engagement_score`** = `inci_tooltips_opened` + `accordion_opens` (pondéré 2× + 1×). À surveiller en cohort.

## 8. Calendrier

| Phase | Semaine | Durée | Responsable |
|---|---|---|---|
| 0 — Quick wins | S1 lundi | 0,5 j | Dev |
| 1 — Schema étendu | S1 mardi | 0,5 j | Dev |
| 2 — IngredientCard mobile | S1 mercredi-jeudi | 0,75 j | Dev |
| 3 — InciTooltip | S1 vendredi | 0,5 j | Dev |
| 4 — Lien pack + tracking | S2 lundi | 0,25 j | Dev |
| 5 — Admin éditeur | S2 mardi-mercredi | 0,75 j | Dev |
| 6 — E2E Playwright + axe | S2 jeudi | 0,5 j | Dev + QA |
| 7 — Handoff + cleanup | S2 vendredi | 0,25 j | Dev |

**Buffer** : 0,5 j supplémentaire prévu en fin de S2 pour ajustements DA / contenus.
