# Event Mappings — Dossier technique complet

> Système de gestion des correspondances entre événements du dataLayer
> internes (FemiGlow canonical) et événements vendor (Meta, GA4, Google
> Ads, TikTok, Snap, Pinterest, GTM). Versionné, éditable depuis l'admin,
> exportable vers GTM via JSON, avec fallback "configuration par défaut".
>
> Statut : 🟡 **Draft** — pas encore validé pour exécution. Sert de base
> au plan d'action `90-plan/action-plan.yaml`.

## Vision en une phrase

> _Une console admin qui permet de configurer une seule fois le mapping
> events→vendors, de le versionner, de l'exporter dans GTM, et de revenir
> au default en un click._

## Pourquoi maintenant ?

L'existant FemiGlow (tracking-improvement) gère :
- ✅ Le **catalog** des events canoniques (`event-catalog.ts`)
- ✅ Le **mapping en code dur** (`event-mapping.ts`) — modif = PR + deploy
- ✅ La **catégorisation Google Ads** override DB (`/admin/tracking/events/categorization`)
- ❌ **Pas d'UI** pour éditer le mapping nom-event par provider
- ❌ **Pas d'export GTM** automatique (export JSON manuel)
- ❌ **Pas de versioning** des mappings (un seul état "code courant")

Ce dossier conçoit la pièce manquante.

## Index

| # | Dossier | Format(s) | Objet |
|---|---|---|---|
| 00 | [00-overview/](./00-overview/) | .md | Executive summary, scope, glossaire, success criteria, stakeholders |
| 10 | [10-architecture/](./10-architecture/) | .puml .md | Diagrammes composants/sequences, 4 ADRs, data-flow |
| 20 | [20-data/](./20-data/) | .sql .txt .puml .json .csv | Schema DDL, ERD, migrations, default-mapping, seed, dictionary |
| 30 | [30-backend/](./30-backend/) | .yaml .md | OpenAPI contracts, service layer, error codes, validation, audit |
| 40 | [40-frontend/](./40-frontend/) | .md .json | Composants, state, hooks, routing, API client |
| 50 | [50-ui-ux-design/](./50-ui-ux-design/) | .md .txt .csv | Wireframes ASCII, design tokens, a11y, interactions, microcopy |
| 60 | [60-analytics/](./60-analytics/) | .csv .md | KPIs usage, audit events catalog |
| 70 | [70-tests/](./70-tests/) | .csv .md | Test matrix, vitest/playwright/MSW suites, e2e scenarios, coverage targets |
| 80 | [80-runbook/](./80-runbook/) | .md | Deployment, rollback, smoke, incident, operations |
| 90 | [90-plan/](./90-plan/) | .yaml .csv .md | Action plan, dev plan, milestones, risks, decision log |

## Lecture suggérée

| Lecteur | Lire d'abord |
|---|---|
| **PM / Tech Lead** | `CONCEPTUAL-ANALYSIS.md` → `00-overview/executive-summary.md` → `90-plan/milestones.md` |
| **Backend dev** | `10-architecture/adr-*` → `20-data/schema.txt` → `30-backend/api-contracts.yaml` |
| **Frontend dev** | `40-frontend/components.md` → `50-ui-ux-design/wireframes/` → `50-ui-ux-design/interactions.md` |
| **QA** | `70-tests/test-matrix.csv` → `70-tests/e2e-scenarios.md` |
| **Ops / SRE** | `80-runbook/deployment.md` → `80-runbook/rollback.md` |
| **Marketing / Stakeholder** | `00-overview/scope.md` → `50-ui-ux-design/wireframes/matrix-mapping.txt` |

## Conventions

- **Formats par usage** : `.md` (humain), `.puml` (diagrammes), `.yaml` (config séquencée + OpenAPI), `.json` (config typée), `.csv` (tables), `.sql` (DDL), `.txt` (schémas/wireframes ASCII)
- **Niveau de détail** : suffisant pour démarrer le dev sans questions d'architecture ou UX
- **Versionnage** : ce dossier est versionné dans git, chaque ADR a un statut explicite (proposed/accepted/rejected/superseded)
- **Idempotence** : tous les SQL, scripts, runbook commands sont idempotents
