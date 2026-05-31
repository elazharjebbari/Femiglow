# Plan d'action — refonte « La composition » (/kit)

Refonte du bloc `CompositionReveal` de la page `/kit` selon les principes Kolenda (Attention / Color / Copywriting / Ecommerce / Fonts / Luxury / Pricing / UX), avec extension du modèle de données, ouverture à l'éditabilité admin, animations, et stratégie de tests complète.

## Statut

| Phase | Sujet | Effort | Risque | Statut |
|---|---|---|---|---|
| 0 | Quick wins P0 visuels (numéro, bordure, fond sable, sensation, copy) | 0,5 j | Très faible | À faire |
| 1 | Schema `SubProduct` étendu + seed mock + tests Zod | 0,5 j | Faible | À faire |
| 2 | `CompositionCard` dédié (sortie de `ProductCard`) + Vitest unit | 1 j | Faible | À faire |
| 3 | Image contextuelle au hover/tap (crossfade + a11y mobile) | 1 j | Moyen | À faire |
| 4 | Animations reveal au scroll (Framer Motion, stagger 120 ms) | 0,5 j | Faible | À faire |
| 5 | Vue éclatée annotée en tête de section | 1,5 j (dont DA visuelle) | Moyen | À faire |
| 6 | Admin éditeur « Composition Kit » — sous `/admin/kit/composition` | 2 j | Moyen | À faire |
| 7 | MSW + Playwright E2E (rendu + interactions + a11y) | 1 j | Faible | À faire |
| 8 | Documentation publique + handoff DA | 0,5 j | Très faible | À faire |

**Total** : ~8 j homme. Phases 0-2 livrables dans la semaine. Phases 5-6 livrables dans la suivante.

## Documents du dossier

1. [`01-context-analyse.md`](01-context-analyse.md) — Analyse Kolenda du composant actuel : forces, faiblesses, citations source.
2. [`02-vision-objectifs.md`](02-vision-objectifs.md) — Vision, principes directeurs, KPI mesurables.
3. [`03-data-model.md`](03-data-model.md) — Schema `SubProduct` étendu, mock, migration éventuelle Sanity, contrats Zod.
4. [`04-backend-design.md`](04-backend-design.md) — Services CMS, adapter mock + Sanity, API admin pour la composition, validation et cache.
5. [`05-frontend-public-design.md`](05-frontend-public-design.md) — `CompositionReveal v2`, `CompositionCard`, motion, responsive, charte visuelle.
6. [`06-admin-ui-ux-design.md`](06-admin-ui-ux-design.md) — Éditeur admin sous-produits, design tokens, formulaire, preview, états.
7. [`07-tests-strategy.md`](07-tests-strategy.md) — Vitest (unit + integration MSW) + Playwright (E2E + a11y), pyramide.
8. [`08-plan-action-phases.md`](08-plan-action-phases.md) — Découpage 9 phases test-first avec checklists par phase.
9. [`09-runbook-execution.md`](09-runbook-execution.md) — Runbook d'exécution opérationnel : commandes, validations, rollback, commits.
10. [`10-acceptance-criteria.md`](10-acceptance-criteria.md) — Critères d'acceptation par phase + non-régression globale.

## Ordre de lecture recommandé

- **Pour cadrer** : `01` → `02` → `08`.
- **Pour designer** : `03` → `04` → `05` → `06`.
- **Pour implémenter** : `08` (phases) en référence permanente, `07` (tests) en parallèle.
- **Pour exécuter** : `09` (runbook) avec `10` (acceptation) en filet de sécurité.

## Principes directeurs

1. **Test-first sur la logique métier**. Schema Zod, résolution media, parsing copy : tests avant code.
2. **Composant dédié**. `CompositionCard` extrait de `ProductCard` — découplage maintenance (ProductCard est exclusive à cette section actuellement mais le contrat évolue différemment).
3. **CMS-piloté dès la phase 1**. Extension `SubProduct` côté schema + mock + adapter Sanity (placeholder). Pas de hardcode supplémentaire.
4. **Éditabilité admin native**. À partir de la phase 6, un éditeur dédié sous `/admin/kit/composition` pilote nom, volume, description courte, sensation, ingrédients, image isolated + contextual.
5. **Zéro régression**. Snapshot du DOM `/kit` (section `#composition-title`) pinné en Vitest + Playwright avant chaque PR.
6. **Charte « maison »**. Aucun emoji, vocabulaire `rituel / initiée / geste / saison`, palette sauge/sable/champagne, animations ≥ 400 ms.
7. **Accessibilité WCAG AA**. Focus visible, labels, contrast ratio, navigation clavier, screenreader-friendly pour les 3 cards (rôle `list` + `listitem` déjà OK).

## Hors périmètre

Ce plan ne traite pas :

- La refonte du Hero produit (déjà couverte par `docs/kit-hero-optim/`).
- La refonte du bandeau geo-promo (déjà partiellement traitée dans le commit `2f3a0e9`).
- Le ravalement complet de la section INCI (`IngredientsDetails`) — un autre dossier dédié.
- L'introduction de Sanity comme CMS (Phase 2 du roadmap CMS, hors scope ici).
- Le scroll-snap horizontal mobile (P3 backlog ; arbitrage A/B à venir).

## Référence

- Analyse source : conversation du 2026-05-20 (revue Kolenda du bloc composition).
- Playbook Kolenda : `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §4.3 « La composition ».
- Inventaire technique : agent Explore du 2026-05-20 — `SubProduct` schema, usages `ProductCard`, mock, mediaSlots, tests existants.
- Convention dossier : alignée sur `docs/seo-action-plan-2026-05/` et `docs/kit-hero-optim/`.
