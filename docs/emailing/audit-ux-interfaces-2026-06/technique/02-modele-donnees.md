# Plan data — évolutions du modèle de données

> Contrainte absolue ([[deploy-infra-single-instance]]) : **migrations
> additives uniquement** (colonnes nullable ou DEFAULT, nouvelles tables,
> nouveaux index `CONCURRENTLY`). Aucun DROP/RENAME/NOT NULL rétroactif.
> Chaque migration est livrée AVANT le code qui la lit (déploiement en 2 temps
> possible sans fenêtre).

## 1. Évolutions par chantier

### F02 — Navigation (compteurs)
Aucune évolution : `nav-counters` agrège des requêtes existantes
(count dlq, runs errored, sync KO). Cache applicatif 30 s (unstable_cache avec
TTL EXPLICITE — gotcha i18n bindings : jamais de unstable_cache sans TTL).

### F04 — Cockpit (export serveur, retry par filtre)
Aucune colonne nouvelle. Deux précautions :
- export streamé : curseur Drizzle/SQL paginé par `id` (keyset), cap 100 000
  lignes, en-tête `Content-Disposition` daté.
- `bulk-retry-by-filter` : réutilise le compilateur de filtres serveur
  (`filters-parser` → SQL) déjà utilisé par `/search` — AUCUNE duplication de
  logique de filtre.

### F05 — Campagnes
```sql
ALTER TABLE email_campaign ADD COLUMN IF NOT EXISTS wizard_step smallint;          -- reprise wizard (1..6, null = legacy)
ALTER TABLE email_campaign ADD COLUMN IF NOT EXISTS schedule_timezone text;        -- ex. 'Africa/Casablanca' (null = legacy/navigateur)
```
- Détection orpheline : AUCUNE colonne — requête `status='sending' AND
  listmonk_campaign_id IS NULL AND started_at < now()-interval '10 min'`.
- A/B (CAMP-13) : décision produit préalable ; si GO, table dédiée
  `email_campaign_variant` (hors périmètre de ce programme).

### F06 — Automations
```sql
ALTER TABLE email_automation ADD COLUMN IF NOT EXISTS deleted_at timestamptz;      -- soft-delete (R-031)
-- trace d'exécution par étape : portée par contextJson._trace (JSONB existant),
-- AUCUNE migration. Forme (validée Zod côté runner) :
--   _trace: [{ stepIdx, kind, startedAt, finishedAt, outcome: 'ok'|'deferred'|'skipped'|'error',
--              detail?: string, meta?: object }]
ALTER TABLE email_automation_run ADD COLUMN IF NOT EXISTS is_dry_run boolean NOT NULL DEFAULT false;
```
- Les runs dry-run sont EXCLUS des KPI/daily-cap (`WHERE NOT is_dry_run`
  ajouté aux requêtes de comptage — point de vigilance n°1 du chantier F06).
- `softDeleteAutomation` : refus si `EXISTS run WHERE status IN
  ('running','waiting_for_event')` ; les requêtes de liste filtrent
  `deleted_at IS NULL`.

### F07 — Templates
```sql
-- autosave brouillon : choix V1 = localStorage côté client (zéro migration).
-- Si l'équipe préfère le serveur (multi-poste), option V2 :
ALTER TABLE email_template_custom ADD COLUMN IF NOT EXISTS draft_json jsonb;       -- { subject, preheader, htmlSource, customVars, savedAt }
```
- Diff de versions : aucun besoin data (les deux sources existent).
- `deleted_at` existe déjà (soft-delete en place, seul le bouton manque).

### F09 — Suppression
Aucune migration : `addSuppression()` couvre l'ajout manuel ; `detail` devient
OBLIGATOIRE côté validation Zod quand `reason='manual_admin'` (contrainte
applicative, pas DB). Bulk-remove = DELETE par lot existant, audit-loggé.

### F10 — Listmonk observabilité
```sql
ALTER TABLE email_campaign_link ADD COLUMN IF NOT EXISTS last_sync_attempt_at timestamptz;
ALTER TABLE email_campaign_link ADD COLUMN IF NOT EXISTS last_sync_ok_at      timestamptz;
ALTER TABLE email_campaign_link ADD COLUMN IF NOT EXISTS last_sync_error     text;
```
`syncCampaignStatuses()` met à jour les 3 champs à chaque passage (attempt
systématique, ok/error selon résultat, error tronquée à 500 car.).

### F08 — Audiences
Aucune migration. La neutralisation has_tag/not_has_tag est purement UI +
un garde-fou compilateur (warning loggé si une règle tag est compilée).
Lever la neutralisation = livraison M5.5 (hors programme).

## 2. Index

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS email_automation_deleted_idx
  ON email_automation (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS email_automation_run_dry_idx
  ON email_automation_run (automation_id, triggered_at) WHERE NOT is_dry_run;
-- export cockpit : l'index (created_at) existant suffit (keyset sur id).
```

## 3. Stratégie de migration & test

| Étape | Action | Test associé |
|---|---|---|
| M1 | Génération Drizzle (`drizzle-kit generate`) — relire le SQL produit (gotcha lead_tag : drift schema.ts/DB réel) | test d'intégration `schema-drift` : introspection DB test vs schema.ts |
| M2 | Application sur `femiglow_test` puis `femiglow_emailqa` (clone prod, drift préservé) | suite intégration complète verte sur les DEUX bases |
| M3 | Prod : `psql` transactionnel hors index CONCURRENTLY (séparés) | smoke lecture (`SELECT` des nouvelles colonnes) + restart service |
| M4 | Déploiement du code lecteur | batterie du chantier concerné |

Rollback : les colonnes additives inutilisées sont inertes — le rollback d'un
chantier est un rollback de CODE uniquement (aucune migration descendante).

## 4. Données de test (builders)

Toute nouvelle forme a son builder dans `src/test/factories/emails.factory.ts`
(convention existante `makeOutboxRow`, `makeEmailAudience`…) :
`makeTraceEntry`, `makeDryRun`, `makeCampaignLinkSyncState`, `makeSuppressionEntry`
(+ presets : `traceWithError`, `orphanCampaign`, `staleSyncLink`).
Les handlers MSW (`src/test/msw/emails-handlers.ts`) sont étendus dans le MÊME
commit que chaque nouveau contrat (cf. `05-strategie-tests.md` §3.2).
