# Unified Tracking System — Dossier technique

> **Statut :** Étape B — Spécification technique complète
> **Préalable :** [docs/gtm/18-unified-tracking-system-conceptual.md](../18-unified-tracking-system-conceptual.md) (étape A, conceptuel)
> **Date :** 2026-05-14
> **Cible delivery :** v1 prête à coder en sprints de 1-2 semaines

---

## Pourquoi ce dossier

Le dossier conceptuel `18-unified-tracking-system-conceptual.md` a proposé une approche hybride **B (Tracking Plan, source de vérité unique) + D (Wizard-First, expérience guidée)** pour résoudre les frictions actuelles des 5 sous-systèmes de tracking (Pixel, Mapping, GTM Sync, Valider Import GTM, Export GTM).

Ce **dossier technique** transforme cette proposition en spécification exécutable :
- Schémas de données précis.
- Contrats d'API formels.
- Arbre de composants frontend.
- Maquettes ergonomiques.
- Plan d'implémentation séquencé.
- Batterie de tests (Jest + Playwright + MSW) avec un test d'intégration ultime.

Chaque sous-dossier est autonome (lisible isolément) mais s'inscrit dans l'ensemble. Les renvois croisés sont explicites.

---

## Index des sections

| # | Dossier | Mission | Format clé |
|---|---|---|---|
| 01 | [architecture/](./01-architecture/) | Vue système, ADRs, diagrammes haut niveau | `.puml`, `.md` |
| 02 | [data/](./02-data/) | Schéma DB, Zod, migration, seeds | `.hjson`, `.sql`, `.csv`, `.puml` |
| 03 | [backend/](./03-backend/) | Services, APIs REST, contrats OpenAPI | `.yaml`, `.md`, `.puml` |
| 04 | [frontend/](./04-frontend/) | Composants, state, routing | `.md`, `.puml` |
| 05 | [analytics/](./05-analytics/) | Catalog événements, matrices providers, consent | `.csv`, `.md`, `.puml` |
| 06 | [ui/](./06-ui/) | Design system, librairie composants | `.md` |
| 07 | [ux/](./07-ux/) | Personas, journeys, wizards | `.md`, `.puml` |
| 08 | [design/](./08-design/) | Couleurs, typo, espacements, motion | `.md`, `.yaml` |
| 09 | [ergonomics/](./09-ergonomics/) | Admin + Chat ergonomics, a11y, raccourcis | `.md`, `.csv` |
| 10 | [conception-plan/](./10-conception-plan/) | Plan de conception, milestones | `.md`, `.csv` |
| 11 | [development-plan/](./11-development-plan/) | Plan dev, backlog tickets, timeline | `.md`, `.csv`, `.txt` |
| 12 | [action-plan/](./12-action-plan/) | Phases d'exécution opérationnelles | `.md`, `.yaml` |
| 13 | [runbook/](./13-runbook/) | Déploiement, rollback, incidents | `.md` |
| 14 | [tests/](./14-tests/) | Stratégie + Jest + Playwright + MSW + test ultime | `.md`, `.yaml`, `.csv` |

---

## Conventions du dossier

- **Numérotation `NN-`** : ordre suggéré de lecture, pas une dépendance dure.
- **Fichiers `README.md` par sous-dossier** : résumé et navigation locale.
- **Diagrammes** : PlantUML (`.puml`) — rendus à la volée par GitHub ou avec `plantuml -tpng`.
- **Schémas Zod** : HJSON commenté (`.hjson`) pour la documentation, TypeScript canonique dans le code (`apps/web/src/lib/tracking/plan/schema.ts`).
- **Tests** : noms de fichiers exemples (à créer en phase impl). On précise la *forme* attendue, pas la transcription octet-pour-octet.

---

## Statuts d'avancement

| Section | Spec rédigée | Code | Tests | Déployé |
|---|---|---|---|---|
| 01–14 | ✓ | — | — | — |

Cocher au fur et à mesure de l'exécution.

---

## Liens utiles

- Document conceptuel (étape A) : [../18-unified-tracking-system-conceptual.md](../18-unified-tracking-system-conceptual.md)
- Docs GTM existantes : [../README.md](../README.md)
- Schéma DB courant : `apps/web/src/lib/db/schema.ts`
- Code tracking actuel : `apps/web/src/lib/tracking/`
