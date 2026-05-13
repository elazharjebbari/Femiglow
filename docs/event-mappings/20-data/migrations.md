# 20.3 — Migrations DB

## Plan migrations

| # | Tag | Effet | Reversible |
|---|---|---|---|
| 0032 | `event_mapping_versions` | Crée table + indexes + contraintes | ✅ DROP TABLE |
| 0033 | `event_mapping_audit` | Crée table audit + indexes | ✅ DROP TABLE |
| 0034 | `event_mapping_seed_default` | Insert/upsert version `__default__` depuis fichier JSON | ✅ DELETE WHERE id = '__default__' |

Les migrations sont **idempotentes** (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `INSERT ... ON CONFLICT DO UPDATE`).

## 0032 — Création `event_mapping_versions`

```sql
-- ===========================================================================
-- Migration 0032 — Event mappings : table versioning principale
-- ---------------------------------------------------------------------------
-- Conserve les snapshots complets de la matrice mappings event×provider.
-- Une seule version active à la fois (UNIQUE index conditionnel).
-- cf. docs/event-mappings/10-architecture/adr-001-versioning-strategy.md
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "event_mapping_versions" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "notes" text,
  "status" text NOT NULL CHECK (status IN ('draft','active','archived','deleted')),
  "is_active" boolean NOT NULL DEFAULT false,
  "is_default" boolean NOT NULL DEFAULT false,
  "mappings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "cloned_from" text REFERENCES "event_mapping_versions"("id") ON DELETE SET NULL,
  "created_by" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "activated_at" timestamptz,
  "archived_at" timestamptz,
  "deleted_at" timestamptz,
  CONSTRAINT "no_delete_default" CHECK (NOT (is_default = true AND status = 'deleted'))
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "event_mapping_versions_one_active"
  ON "event_mapping_versions" ("is_active") WHERE "is_active" = true;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "event_mapping_versions_status_idx"
  ON "event_mapping_versions" ("status", "created_at" DESC);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "event_mapping_versions_default_idx"
  ON "event_mapping_versions" ("is_default") WHERE "is_default" = true;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "event_mapping_versions_mappings_gin"
  ON "event_mapping_versions" USING GIN ("mappings");
```

## 0033 — Création `event_mapping_audit`

```sql
-- ===========================================================================
-- Migration 0033 — Event mappings : audit log structuré
-- ---------------------------------------------------------------------------
-- Conserve l'historique complet (qui, quoi, quand, before/after) des mutations
-- sur event_mapping_versions. Conservé indéfiniment.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "event_mapping_audit" (
  "id" text PRIMARY KEY,
  "version_id" text REFERENCES "event_mapping_versions"("id") ON DELETE SET NULL,
  "action" text NOT NULL CHECK (action IN (
    'create','edit','activate','archive','delete',
    'restore','duplicate','reset_to_default',
    'export_gtm','test_event'
  )),
  "actor_id" text NOT NULL,
  "before" jsonb,
  "after" jsonb,
  "meta" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "ip_anonymized" text,
  "ua_hash" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "event_mapping_audit_version_idx"
  ON "event_mapping_audit" ("version_id", "created_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "event_mapping_audit_actor_idx"
  ON "event_mapping_audit" ("actor_id", "created_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "event_mapping_audit_action_idx"
  ON "event_mapping_audit" ("action", "created_at" DESC);
```

## 0034 — Seed `__default__` (idempotent)

```sql
-- ===========================================================================
-- Migration 0034 — Event mappings : insert/upsert version __default__
-- ---------------------------------------------------------------------------
-- ATTENTION : cette migration insère un placeholder vide. Le seed RÉEL des
-- mappings est fait par `scripts/seed-tracking.ts` qui lit le fichier
-- `docs/event-mappings/20-data/default-mapping.json` (source de vérité,
-- versionnée git, evolutivable sans migration).
-- ===========================================================================

INSERT INTO "event_mapping_versions" (
  id, name, status, is_active, is_default, mappings, created_by
) VALUES (
  '__default__',
  'FemiGlow Factory Default',
  'archived',
  false,
  true,
  '{}'::jsonb,
  'system'
)
ON CONFLICT (id) DO NOTHING;
```

## Rollback

Le rollback est trivial puisque tout est additif :

```sql
DROP TABLE IF EXISTS "event_mapping_audit";
DROP TABLE IF EXISTS "event_mapping_versions";
```

Pas d'enum custom à drop, pas de modif sur tables existantes.

## Ordre d'exécution en prod

1. `pnpm --filter @femiglow/web db:migrate` (applique 0032, 0033, 0034)
2. `pnpm --filter @femiglow/web seed:tracking` (charge le default-mapping.json dans `__default__`)
3. Vérifier en SQL :
   ```sql
   SELECT id, name, status, is_active, is_default, jsonb_object_keys(mappings) as events
   FROM event_mapping_versions
   WHERE is_default = true;
   -- Doit retourner __default__ avec ~30 events listés
   ```
4. Activer `__default__` la première fois :
   ```sql
   UPDATE event_mapping_versions SET is_active = true, status = 'active', activated_at = now()
   WHERE id = '__default__';
   ```
   Ou via l'admin UI bouton "Activer le default".
