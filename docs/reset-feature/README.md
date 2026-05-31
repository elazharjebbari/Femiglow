# Reset Feature — Dossier de conception

> Système de **réinitialisation contrôlée** de FemiGlow : DB + médias + cache, avec backup
> automatique, reversibilité, et UI wizard dans l'admin.
>
> Statut : **DRAFT** (en attente de validation) · Auteur : Claude (assisté) · Branche : `master`

## Objectif

Fournir un mécanisme **fiable, reversible et auditable** pour ramener l'environnement à un
état seedé canonique, accessible :

- **Via UI** : `/admin/settings/reset` (wizard multi-étapes avec live progress)
- **Via CLI** : `pnpm --filter @femiglow/web reset -- [flags]`

## Niveaux de reset

| Niveau   | DB                                | Médias        | Cache `.next` | Données users      | Backup obligatoire |
|----------|-----------------------------------|---------------|---------------|--------------------|--------------------|
| `soft`   | seeders only (upsert)             | conservés     | non touché    | conservées          | ⚠ recommandé        |
| `medium` | TRUNCATE catalogue/CMS/SEO        | conservés     | non touché    | conservées          | ✅ oui              |
| `hard`   | DROP SCHEMA + migrate + seed      | wipe          | wipe          | wipe (sauf admin)   | ✅ oui (refusé sinon) |
| `custom` | sélection par domaine             | au choix      | au choix      | au choix            | ✅ oui              |

## Index du dossier

| # | Fichier                                       | Format       | Sujet                                              |
|---|-----------------------------------------------|--------------|----------------------------------------------------|
| 00| [00-vision.md](./00-vision.md)                | Markdown     | Vision, exigences fonctionnelles/non-fonctionnelles |
| 01| [01-architecture.puml](./01-architecture.puml)| PlantUML     | Diagramme de composants (backend + frontend)        |
| 02| [02-dataflow.puml](./02-dataflow.puml)        | PlantUML     | Diagramme de séquence runtime (wizard → reset)      |
| 03| [03-design-backend.md](./03-design-backend.md)| Markdown     | Conception backend détaillée                        |
| 04| [04-design-frontend.md](./04-design-frontend.md)| Markdown   | Conception frontend détaillée                       |
| 05| [05-ui-ux.md](./05-ui-ux.md)                  | Markdown     | Wireframes ASCII, principes ergonomiques            |
| 06| [06-wizard-steps.json](./06-wizard-steps.json)| JSON         | Configuration déclarative des steps du wizard       |
| 07| [07-dev-plan.csv](./07-dev-plan.csv)          | CSV          | Plan de développement (tâches/effort/dépendances)   |
| 08| [08-action-plan.yaml](./08-action-plan.yaml)  | YAML         | Plan d'action haute niveau séquencé                 |
| 09| [09-rollback.md](./09-rollback.md)            | Markdown     | Procédure de rollback / reversibilité               |
| 10| [10-error-taxonomy.md](./10-error-taxonomy.md)| Markdown     | Taxonomie des erreurs + tolérance à l'échec         |
| 11| [11-data-model.txt](./11-data-model.txt)      | Plain-text   | Tables/colonnes touchées + impact par mode          |
| 12| [12-config-schema.json](./12-config-schema.json)| JSON Schema| Schéma de la config d'un reset (validation runtime) |
| 13| [13-runbook.md](./13-runbook.md)              | Markdown     | Runbook exécutable étape par étape                  |
| 14| [14-tests-matrix.csv](./14-tests-matrix.csv)  | CSV          | Matrice Jest / MSW / Playwright                     |
| 15| [15-observability.md](./15-observability.md)  | Markdown     | Logs, metrics, audit, événements SSE                |

## Principes directeurs

1. **Backup-first** — aucun reset destructif sans snapshot DB + média validé sur disque.
2. **Idempotent** — relancer un reset deux fois doit converger vers le même état.
3. **Reversible** — toute opération doit pouvoir être annulée via `reset restore --backup-id=…`.
4. **Tolérance à l'échec** — l'échec d'une phase non critique ne casse pas le reset.
5. **Observable** — chaque phase émet logs structurés + événement SSE + audit DB.
6. **Modulaire** — chaque phase est une fonction pure testable, sans couplage UI.
7. **Sécurisé** — confirmation typée + double-auth pour `hard`.

## Lien avec l'existant

- Réutilise `SEEDERS_REGISTRY` (lib/seeders/registry.ts) pour la phase « seed ».
- Réutilise `job-store` + orchestrator pattern (lib/seeders/{job-store,orchestrator}.ts).
- Réutilise `requireAdmin`, `AdminShell`, `logAuditEvent`.
- Ajoute :
  - `lib/reset/` — phases, planner, backup, restore
  - `app/api/admin/reset/*` — routes API
  - `app/admin/settings/reset/page.tsx` + composants
  - `scripts/reset.ts` — entry-point CLI
