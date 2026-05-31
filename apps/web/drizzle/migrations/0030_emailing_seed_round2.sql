-- 0030_emailing_seed_round2 — Seed 3 additional templates (M1.B).
--
-- Idempotent via ON CONFLICT DO NOTHING — re-runs are no-op.
--
-- Cf. lib/mail/catalog.ts for the canonical TEMPLATE_REGISTRY (this table
-- is a runtime metadata mirror : active flag, lastUsedAt, versioning).

INSERT INTO "email_template_meta"
  ("slug", "display_name", "category", "description", "variables", "active", "version")
VALUES
  ('newsletter-confirm',
   'Newsletter — double opt-in',
   'transactional',
   'Confirmation de l''inscription à la newsletter (RGPD/CNDP double opt-in).',
   '[
     {"name":"confirmUrl","type":"url","required":true,"label":"URL de confirmation","sample":"https://femiglow-maroc.com/newsletter/confirm?t=…"}
   ]'::jsonb,
   true,
   1),
  ('lead-notification',
   'Notification lead chat (admin)',
   'transactional',
   'Notification interne envoyée à info@ quand un visiteur soumet le formulaire de lead du chat.',
   '[
     {"name":"leadName","type":"text","required":true,"label":"Prénom lead","sample":"Souheila"},
     {"name":"leadPhone","type":"text","required":true,"label":"Téléphone","sample":"+212 6 12 34 56 78"},
     {"name":"leadEmail","type":"text","required":false,"label":"Email (optionnel)","sample":"souheila@example.com"},
     {"name":"intent","type":"text","required":true,"label":"Intent détecté","sample":"achat-rituels"},
     {"name":"outcomeContext","type":"text","required":true,"label":"Contexte chat","sample":"..."},
     {"name":"adminUrl","type":"url","required":true,"label":"URL admin","sample":"https://admin.femiglow-maroc.com/admin/leads/123"}
   ]'::jsonb,
   true,
   1),
  ('password-reset',
   'Réinitialisation mot de passe',
   'transactional',
   'Envoyé sur demande de reset password (admin/user). Lien à durée limitée.',
   '[
     {"name":"firstName","type":"dynamic","required":true,"label":"Prénom","sample":"Souheila"},
     {"name":"resetUrl","type":"url","required":true,"label":"URL de reset","sample":"https://admin.femiglow-maroc.com/auth/reset?token=…"},
     {"name":"expiresInMinutes","type":"number","required":true,"label":"Durée validité (min)","sample":"30"}
   ]'::jsonb,
   true,
   1)
ON CONFLICT ("slug") DO NOTHING;
