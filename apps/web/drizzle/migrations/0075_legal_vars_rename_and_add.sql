-- ============================================================================
-- LEGAL-V2-01 — Réconcilier le naming des variables legal_template_vars.
--
-- Cf. docs/pages-legales-fix-2026-05/02-backend/migrations.md
-- ============================================================================

-- 1. Rename des 6 vars drift
UPDATE "legal_template_vars" SET "key" = 'CONTACT_EMAIL', "label" = 'Email contact', "updated_at" = NOW() WHERE "key" = 'COMPANY_EMAIL';
--> statement-breakpoint
UPDATE "legal_template_vars" SET "key" = 'CONTACT_PHONE', "label" = 'Téléphone contact', "updated_at" = NOW() WHERE "key" = 'COMPANY_PHONE';
--> statement-breakpoint
UPDATE "legal_template_vars" SET "key" = 'HOST_ADDRESS', "label" = 'Hébergeur — adresse', "updated_at" = NOW() WHERE "key" = 'HOSTING_ADDRESS';
--> statement-breakpoint
UPDATE "legal_template_vars" SET "key" = 'HOST_NAME', "label" = 'Hébergeur — nom', "updated_at" = NOW() WHERE "key" = 'HOSTING_NAME';
--> statement-breakpoint
UPDATE "legal_template_vars" SET "key" = 'HOST_CONTACT', "label" = 'Hébergeur — contact', "updated_at" = NOW() WHERE "key" = 'HOSTING_PHONE';
--> statement-breakpoint
UPDATE "legal_template_vars" SET "key" = 'CNDP_DECLARATION_REF', "label" = 'CNDP — référence déclaration', "updated_at" = NOW() WHERE "key" = 'CNDP_DECLARATION';
--> statement-breakpoint

-- 2. INSERT des 6 vars manquantes
INSERT INTO "legal_template_vars" ("key", "label", "description", "value", "is_required", "sensitive", "updated_at")
VALUES
  ('COOLING_OFF_DAYS', 'Délai de rétractation (jours)', 'Nombre de jours pour rétractation. Au Maroc : 7 jours pour la vente à distance.', '7', false, false, NOW()),
  ('CURRENCY', 'Devise', 'Code ISO de la devise utilisée (MAD pour Maroc).', 'MAD', false, false, NOW()),
  ('DATA_RETENTION_YEARS', 'Rétention données (années)', 'Durée de conservation des données personnelles. CNDP recommande 3 ans.', '3', false, false, NOW()),
  ('DELIVERY_PARTNER', 'Partenaire livraison', 'Nom du transporteur partenaire (Amana, DHL Maroc, Aramex...).', '', true, false, NOW()),
  ('PAYMENT_PROVIDERS', 'Prestataires paiement', 'Liste des prestataires de paiement utilisés.', 'CMI', false, false, NOW()),
  ('SUPPORT_HOURS', 'Horaires support', 'Plage horaire du support client (format libre).', 'Lundi-Vendredi 9h-18h (heure marocaine)', false, false, NOW())
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint

-- 3. Marquer les vars sensibles (utilisé par UI/render pour "info sur demande")
UPDATE "legal_template_vars" SET "sensitive" = true, "updated_at" = NOW()
 WHERE "key" IN ('ICE', 'COMPANY_RC', 'COMPANY_ADDRESS', 'COMPANY_FORM', 'COMPANY_CAPITAL', 'DIRECTOR_NAME');
--> statement-breakpoint

-- 4. Marquer vars inutilisées comme non-requises
UPDATE "legal_template_vars" SET "is_required" = false, "updated_at" = NOW()
 WHERE "key" IN ('COMPANY_PATENTE', 'COMPANY_TVA', 'DPO_EMAIL') AND "is_required" = true;
--> statement-breakpoint

-- 5. Marquer aussi les vars sensibles comme non-requises (elles seront affichées
-- en "info sur demande" donc pas besoin de bloquer le publish)
UPDATE "legal_template_vars" SET "is_required" = false, "updated_at" = NOW()
 WHERE "sensitive" = true AND "is_required" = true;
--> statement-breakpoint

-- ============================================================================
-- ROLLBACK (à exécuter si besoin de revert)
-- ============================================================================
-- UPDATE legal_template_vars SET key = 'COMPANY_EMAIL' WHERE key = 'CONTACT_EMAIL';
-- UPDATE legal_template_vars SET key = 'COMPANY_PHONE' WHERE key = 'CONTACT_PHONE';
-- UPDATE legal_template_vars SET key = 'HOSTING_ADDRESS' WHERE key = 'HOST_ADDRESS';
-- UPDATE legal_template_vars SET key = 'HOSTING_NAME' WHERE key = 'HOST_NAME';
-- UPDATE legal_template_vars SET key = 'HOSTING_PHONE' WHERE key = 'HOST_CONTACT';
-- UPDATE legal_template_vars SET key = 'CNDP_DECLARATION' WHERE key = 'CNDP_DECLARATION_REF';
-- DELETE FROM legal_template_vars WHERE key IN
--   ('COOLING_OFF_DAYS','CURRENCY','DATA_RETENTION_YEARS','DELIVERY_PARTNER',
--    'PAYMENT_PROVIDERS','SUPPORT_HOURS');
-- UPDATE legal_template_vars SET sensitive = false WHERE sensitive = true;
