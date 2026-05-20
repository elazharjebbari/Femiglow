# Plan d'action SEO — FemiGlow (mai 2026)

Plan d'action complet pour combler les manques identifiés dans l'audit du système SEO du site `femiglow.ma` (rendu public, modèle CMS, API admin, interface admin). Ce dossier couvre la conception, l'implémentation, les tests et l'exécution.

## Statut

| Phase | Sujet | Effort | Risque | Statut |
|---|---|---|---|---|
| 0 | Hot patches (P0) — metadata `/commander`, `/merci`, confirm bulk delete | 1 h | Très faible | À faire |
| 1 | Sitemap `lastModified` depuis DB + JSON-LD revalidation | 2 h | Faible | À faire |
| 2 | Media picker OG image dans l'éditeur SEO admin | 1 j | Faible | À faire |
| 3 | Panel d'audit log SEO dans l'admin | 0,5 j | Très faible | À faire |
| 4 | Endpoint de génération d'OG images dynamiques (templates) | 2 j | Moyen | À faire |
| 5 | Branchement scope `component` au rendu des composants CMS | 2 j | Moyen | À faire |
| 6 | Confort & scale — cache HTTP, canonical normalisation, hreflang UI, sitemap viewer | 2 j | Faible | Backlog |

Total : ~8 jours homme, dont 1 demi-journée de hot-fix immédiat.

## Documents du dossier

1. [`01-context-audit.md`](01-context-audit.md) — Synthèse de l'audit qui justifie ce plan, findings classés par priorité.
2. [`02-vision-objectifs.md`](02-vision-objectifs.md) — Vision SEO de la maison, principes directeurs, KPIs mesurables.
3. [`03-data-model.md`](03-data-model.md) — Modèle Drizzle existant + extensions phase 5 (composants), migrations, contrats Zod.
4. [`04-backend-design.md`](04-backend-design.md) — Services, API routes, validation, cache et revalidation, génération OG.
5. [`05-frontend-public-design.md`](05-frontend-public-design.md) — `generateMetadata`, JSON-LD, sitemap, robots, headers HTTP, intégration composants.
6. [`06-admin-ui-ux-design.md`](06-admin-ui-ux-design.md) — UX admin SEO, design tokens, composants, états, accessibilité.
7. [`07-tests-strategy.md`](07-tests-strategy.md) — Stratégie de tests Vitest (unit + integration MSW) et Playwright (e2e), pyramide de tests.
8. [`08-plan-action-phases.md`](08-plan-action-phases.md) — Découpage en phases avec étapes test-first, checklists par phase.
9. [`09-runbook-execution.md`](09-runbook-execution.md) — Runbook d'exécution opérationnel : commandes, validations, rollback, commits.
10. [`10-acceptance-criteria.md`](10-acceptance-criteria.md) — Critères d'acceptation par phase et tests de non-régression.

## Ordre de lecture recommandé

- **Pour cadrer** : `01` → `02` → `08` (plan haut niveau).
- **Pour designer** : `03` → `04` → `05` → `06` (couches techniques et UX).
- **Pour implémenter** : `08` (phases) en référence permanente, `07` (tests) en parallèle.
- **Pour exécuter** : `09` (runbook) avec `10` (acceptation) en filet de sécurité.

## Principes directeurs du plan

1. **Test-first par défaut**. Chaque phase commence par les tests (Vitest unit + MSW + Playwright si parcours utilisateur), puis l'implémentation, puis la vérification.
2. **Pas de régression**. Chaque phase liste explicitement les tests existants à conserver verts.
3. **Modularité**. Les composants SEO admin (éditeur, picker, preview, panels) restent réutilisables — pas de couplage à une route précise.
4. **Cohérence éditoriale**. Tous les libellés, hints et messages respectent le ton « maison » FemiGlow (pas de marque, pas de cliente, pas d'emoji).
5. **Réversibilité**. Chaque phase a un plan de rollback documenté dans `09-runbook-execution.md`.
6. **Observabilité**. Chaque modification de SEO trace un audit event ; chaque page renvoie des métadonnées résolues vérifiables (header `x-seo-source: override|settings|default`).

## Hors périmètre

Ce plan ne traite pas :

- Le contenu éditorial (densité, mots-clés sémantiques, internal linking) — sujet distinct relevant de la copie maison.
- L'audit Lighthouse / Core Web Vitals — sujet performance traité ailleurs (cf. `docs/kit-hero-optim/` pour les patterns).
- L'expansion multilingue ar-MA / en — le schéma est prêt, l'UI hreflang est planifiée phase 6 mais pas l'i18n applicative.
- L'intégration Google Search Console / Bing Webmaster — validation runtime à programmer après livraison.

## Référence

- Audit source : conversation du 2026-05-19 (audit statique du système SEO).
- Stack : Next.js 14 App Router, Drizzle ORM + PostgreSQL, Zod, React Server Components, Vitest, Playwright, MSW.
- Convention dossier : alignée sur `docs/kit-hero-optim/` et `docs/checkout-funnel/`.
