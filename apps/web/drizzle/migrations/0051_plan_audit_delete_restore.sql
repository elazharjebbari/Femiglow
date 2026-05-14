-- @no-transaction:true
-- Migration 0051 — étendre l'enum tracking_plan_audit_action avec delete + restore.
-- Permet d'auditer la suppression définitive d'un plan ainsi que la restauration
-- d'un plan archivé en brouillon (archived → draft).
-- Note : ALTER TYPE ADD VALUE n'est pas transactionnel (Postgres limitation),
-- d'où le marker @no-transaction:true pour _migrate-safe.mjs.

ALTER TYPE "public"."tracking_plan_audit_action" ADD VALUE IF NOT EXISTS 'delete';
--> statement-breakpoint
ALTER TYPE "public"."tracking_plan_audit_action" ADD VALUE IF NOT EXISTS 'restore';
