-- @no-transaction:true
-- Phase 7E-11 — i18n des témoignages « voix de la maison ».
-- Ajoute la valeur 'en' à l'enum ritual_language pour autoriser les seeds
-- éditoriaux anglais (FR/AR déjà présents). Repli FR géré côté requête.
ALTER TYPE ritual_language ADD VALUE IF NOT EXISTS 'en' AFTER 'ar';
