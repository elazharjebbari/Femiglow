# 02 — Data

Modèle de données du `TrackingPlan` : schéma Postgres, Zod canonique, migration depuis l'existant, seeds.

## Contenu

| Fichier | Contenu |
|---|---|
| [schema.md](./schema.md) | Description textuelle du schéma DB + Zod |
| [tracking-plan.schema.hjson](./tracking-plan.schema.hjson) | Schéma Zod documenté en HJSON commenté |
| [data-model.puml](./data-model.puml) | Diagramme ER PlantUML |
| [migration.sql](./migration.sql) | Migration Drizzle (Postgres) |
| [seed.csv](./seed.csv) | Seed initial des `trackingDefaults` |
| [event-presets.csv](./event-presets.csv) | Presets d'événements proposés à l'admin |

## Invariants de données

- **1 plan actif max** : index unique partiel sur `(status = 'active')`.
- **`bundleId` recalculé à chaque save** : SHA-256 sur JSON canonique (clés triées récursivement).
- **Audit append-only** : aucun UPDATE ni DELETE sur `trackingPlanAudit`.
- **Schéma versionné** : `plan.meta.schemaVersion` (semver) — migrations idempotentes.

## Performance

- Plan typique : 30–80 KB JSONB.
- Index : `GIN (plan)` pour requêtes sur clés (`plan->>'meta'->>'createdBy'`).
- Index : `B-tree (bundleId)` pour drift lookups.
- Index : `B-tree (status, activatedAt DESC)` pour list view.
