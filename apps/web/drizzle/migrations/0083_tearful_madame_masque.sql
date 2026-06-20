-- F05 P3.1 — colonnes ADDITIVES campagnes (déploiement 2 temps, inertes
-- jusqu'à P3.2) : reprise du wizard à la bonne étape + TZ de planification.
--
-- NOTE : `drizzle-kit generate` a aussi proposé un ALTER `lead_tag.id` text→uuid
-- (schema.ts aligné en chantier 1.1 sur la DB prod, mais l'ancien snapshot
-- disait `text`). Cet ALTER est OMIS ici : la DB prod et ses clones sont DÉJÀ
-- en `uuid` (donc no-op) et c'est hors périmètre F05. Le snapshot 0083 reflète
-- déjà `uuid`, la cohérence drizzle est préservée.
ALTER TABLE "email_campaign_link" ADD COLUMN IF NOT EXISTS "wizard_step" smallint;--> statement-breakpoint
ALTER TABLE "email_campaign_link" ADD COLUMN IF NOT EXISTS "schedule_timezone" text;
