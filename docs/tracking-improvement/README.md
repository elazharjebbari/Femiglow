# Tracking Improvement — Dossier technique complet

> Refonte des 4 chantiers identifiés dans l'audit :
> 1. Pipeline de conversion (Google Ads server-side, `form_start`, `CONVERSION_EVENTS`)
> 2. GTM Editor UX (pré-remplissage, édition versions)
> 3. Catégorisation conversions Google Ads
> 4. Observabilité & Consent
>
> Phase 1 : [`CONCEPTUAL-ANALYSIS.md`](./CONCEPTUAL-ANALYSIS.md) — analyse 3 approches/problème + reco
> Phase 2 : ce dossier — dossier technique multi-sous-dossiers

## Index

| # | Dossier | Format(s) | Objet |
|---|---|---|---|
| 00 | [00-overview/](./00-overview/) | .md | Exec summary, glossaire, success criteria, stakeholders |
| 10 | [10-architecture/](./10-architecture/) | .puml .md | Diagrammes composants & séquences, ADR |
| 20 | [20-data/](./20-data/) | .txt .csv .json .puml | Schémas DB, migrations, event-catalog cible, seed |
| 30 | [30-backend/](./30-backend/) | .md .yaml | Google Ads CAPI, pipeline, API endpoints, errors, retry |
| 40 | [40-frontend/](./40-frontend/) | .md .json .yaml | Composants, wizards JSON, state, hooks, API contracts |
| 50 | [50-ui-ux-design/](./50-ui-ux-design/) | .md | Wireframes, design tokens, ergonomie, a11y |
| 60 | [60-analytics/](./60-analytics/) | .csv .md | Taxonomie events, KPIs, attribution, dashboards |
| 70 | [70-tests/](./70-tests/) | .csv .md .ts(snippets) | Matrice Jest+MSW+Playwright + e2e ultime |
| 80 | [80-runbook/](./80-runbook/) | .md | Deploy, rollback, smoke, monitoring, incidents |
| 90 | [90-plan/](./90-plan/) | .csv .yaml .md | Dev plan, action plan, milestones, risks, decision log |

## Conventions

- **Formats par usage** :
  - `.md` : documentation lisible humain
  - `.puml` : diagrammes UML PlantUML
  - `.csv` : tables structurées (test matrix, dev plan)
  - `.yaml` : config séquencée (action plan, API contracts)
  - `.json` : config strictement typée (wizard steps, fixtures)
  - `.txt` : schémas en texte brut (DB columns)
  - `.hjson` : conf humaine permissive (settings)

- **Niveau de détail** : suffisant pour démarrer le dev sans questions de design.

- **Chaque sous-dossier a son `README.md`** qui liste son contenu.

## Périmètre

Couvre exclusivement les améliorations tracking & GTM/Google Ads. Les autres
modules (admin/products, /kit, chat) ne sont pas re-conçus.

## Statut

🟡 **Draft** — pas encore validé pour exécution. Sert de base au plan
d'action qui peut suivre.
