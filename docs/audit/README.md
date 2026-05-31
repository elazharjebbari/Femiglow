# Audit FemiGlow — version actuelle du produit

Ce dossier restitue l'état du projet FemiGlow tel qu'observé en mai 2026, avant la prochaine vague d'itérations (reformulations, variantes produit, nouvelles pages). Il sert de point d'ancrage commun pour tout travail ultérieur : aucune décision UI, copy ou architecture ne doit s'écarter des constats consignés ici sans justification explicite.

## Plan du dossier

| # | Document | Objet |
| --- | --- | --- |
| 00 | [Rapport exécutif](00-rapport-executif.md) | Vue d'ensemble en 5 pages, lectorat décideur |
| 01 | [Codebase & structure du shop](01-codebase-shop.md) | Routes Next.js, composants, librairies métier, tests |
| 02 | [Feeds & base de données](02-feeds-db.md) | Schémas Drizzle, migrations, mock data, content/, feeds produits |
| 03 | [Bonnes pratiques Kolenda](03-kolenda-bonnes-pratiques.md) | Synthèse des 8 PDF + heuristiques transverses |
| 04 | [Charte & architecture du site](04-charte-architecture.md) | Identité, design system, arborescence, navigation |
| 05 | [Catalogue des pages B2C](05-pages-b2c.md) | Détail des 9 pages : objectif, sections, voix, données |
| 06 | [Modules spécialisés](06-modules-specialises.md) | Admin, analytics, chat, tracking, CMS, SEO, media |
| 07 | [Singularités, dette et manques](07-singularites-dette.md) | Décisions fortes, points de friction Phase 2, lacunes |
| 08 | [Plan de correction du contenu](08-plan-correction-contenu.md) | Alignement fixtures + feeds + content sur le brief mai 2026 (Rabat, Souheila, Pack FemiGlow 2 étapes, 199 dh) |
| 09 | [Guide détaillé des modifications](09-guide-modifications-detaille.md) | Page par page, composant par composant, élément par élément : quoi modifier, pourquoi (Kolenda) + 12 propositions d'articles |
| 10 | [Audit application staging — 2026-05-14](audit-application-staging-2026-05-14.md) | Vue globale actuelle du staging : backend, frontend, data, architecture, UI/UX, design, sécurité, tests, docs |

## Méthode

L'audit s'appuie sur trois passes parallèles :

1. **Codebase** — lecture de `apps/web/src/{app,components,lib,data}`, des migrations Drizzle, des configs `next.config.mjs`, `tailwind.config.ts`, `package.json`.
2. **Documents source** — `docs/pages/FemiGlow_Charte_Graphique.md`, `docs/pages/FemiGlow_Architecture_Site.md`, les 9 fiches `docs/pages/b2c/`, le dossier `docs/preparation/` (15 documents + annexes), `docs/plans/`, et tous les README de modules (`docs/admin/`, `docs/chat-assistant/`, `docs/tracking/`, etc.).
3. **Référentiel Kolenda** — lecture intégrale des 8 PDF `docs/kolenda/` pour cadrer les bonnes pratiques applicables aux itérations futures.

## Conventions

- Français, accents soignés, apostrophes courbes, em-dashes littéraux.
- Aucun emoji. Aucune injonction commerciale. Voix « maison / rituel / initiée ».
- Citations file:line quand un appui de code est utile.
- Tableaux préférés aux listes longues pour les inventaires.
