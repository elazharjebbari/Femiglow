# Refonte « Le détail · La composition lue ligne par ligne. » — mai 2026

Plan d'action exhaustif pour la refonte de la section ingrédients de `/kit`
(`<section id="ingredients-details">`). S'applique à la **production
post-vidéo-pivot** : la section qui valide rationnellement l'achat avant
le retour vers le bloc pack.

Cible Kolenda : §4.5 Le détail (INCI) — fiche d'atelier, accordion mobile,
tooltip jargon, intro narrative voix maison, lien retour conversion.

## Sommaire

| # | Document | Rôle |
|---|---|---|
| 01 | [Contexte & analyse](01-context-analyse.md) | Audit existant, principes Kolenda activés, forces/faiblesses |
| 02 | [Vision & objectifs](02-vision-objectifs.md) | KPIs cibles, hypothèses conversion, garde-fous |
| 03 | [Data model](03-data-model.md) | Extensions Zod sur Ingredient/SubProduct, migration rétro-compatible |
| 04 | [Backend design](04-backend-design.md) | Resolver cascade, API admin, persistance, audit log |
| 05 | [Frontend public design](05-frontend-public-design.md) | Composants, responsive split, animations, a11y |
| 06 | [Admin UI/UX design](06-admin-ui-ux-design.md) | Éditeur `/admin/kit/composition`, validation live |
| 07 | [Tests strategy](07-tests-strategy.md) | Vitest + MSW + Playwright + axe, couverture |
| 08 | [Plan d'action par phases](08-plan-action-phases.md) | Découpe en 8 phases ordonnées avec gates |
| 09 | [Runbook d'exécution](09-runbook-execution.md) | Procédure pas-à-pas avec rollback |
| 10 | [Acceptance criteria](10-acceptance-criteria.md) | Checklist exhaustive + non-régression |

## Périmètre

**Inclus** :
- Refonte `IngredientsDetails` + `IngredientsTable` (responsive split mobile)
- Extension `Ingredient.inciDefinition` (tooltip jargon) et `SubProduct.narrative` (intro voix maison)
- Composant `IngredientCard` mobile (carte verticale par ingrédient)
- Composant `InciTooltip` (popover accessible au tap/hover)
- Hiérarchie visuelle : nom + % en gros, INCI en pied, fonction/origine gris
- Accordéon `<details>` natif HTML5 pour les sous-produits sur mobile
- Intro narrative italique sous chaque titre
- Bouton « ↓ Voir le pack » sous chaque sous-produit (lien intra-page tracké)
- Mention gestuelle (« noisette = 10 doigts ») dans le titre
- Admin éditeur `/admin/kit/composition/[id]` pour piloter ces nouveaux champs
- Tests vitest + MSW + Playwright + axe

**Exclus** (backlog) :
- Refonte de la palette ou de la typographie globale
- Phase admin « créer un nouveau sous-produit » (on édite les 3 existants)
- Cross-sell vers d'autres produits
- A/B testing infrastructure (réservé à un futur dossier dédié)

## Cibles métier

| KPI | Baseline | Cible refonte |
|---|---|---|
| Temps moyen sur section (mobile) | ~12 s | **≥ 25 s** |
| Scroll-through vers bloc pack | ~55 % | **≥ 70 %** |
| Taux ouverture accordion (mobile) | n/a | **≥ 40 %** au moins un déplié |
| Taux clic tooltip INCI | n/a | **≥ 15 %** |
| Clic « Voir le pack » depuis section | 0 (inexistant) | **≥ 8 %** |
| Axe a11y `/kit#ingredients-details` | inconnu | **0 violation** sérieuse/critique |

## Effort total estimé

**~3,5 jours-homme** (hors livrable DA) répartis sur 8 phases :

| Phase | Durée | Risque |
|---|---|---|
| 0 — Quick wins Kolenda | 0,5 j | Très faible |
| 1 — Schema étendu | 0,5 j | Faible |
| 2 — IngredientCard mobile | 0,75 j | Moyen |
| 3 — InciTooltip | 0,5 j | Faible |
| 4 — Lien retour pack + tracking | 0,25 j | Très faible |
| 5 — Admin éditeur composition | 0,75 j | Moyen |
| 6 — E2E Playwright + axe | 0,5 j | Faible |
| 7 — Handoff README + cleanup | 0,25 j | Très faible |

## Réutilisation

Réutilise :
- `CompositionCard` accent palette (Kolenda Annexe A)
- `Container`, `Heading`, `Kicker`, `Text` primitifs UI
- `useTracking` + provider analytics existant
- Pattern admin éditeur singleton (cf. `KitVideoEditor`, `SeoOverrideEditor`)
- Resolver cascade override → mock (cf. `lib/kit/video/resolver.ts`)
- DOMPurify isomorphique (déjà installé pour les SVG covers)

## Source de vérité

- Playbook : [`docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md`](../kolenda/FEMIGLOW-KIT-PLAYBOOK.md) §4.5 + §3.8 UX + §3.6 Luxury
- Plans miroirs : [`docs/video-gestes-optim-2026-05/`](../video-gestes-optim-2026-05/), [`docs/composition-reveal-optim-2026-05/`](../composition-reveal-optim-2026-05/)
- Schemas existants : `apps/web/src/lib/schemas/product.ts`
- Composant cible : `apps/web/src/components/sections/IngredientsDetails.tsx`
