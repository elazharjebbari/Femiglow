-- 0031_emailing_automation_seed — seed cart-abandoned-1h automation + template.
--
-- Idempotent : ON CONFLICT DO NOTHING / ON CONFLICT (slug) DO UPDATE for
-- template meta updates.

-- 1. Seed the new template metadata
INSERT INTO "email_template_meta"
  ("slug", "display_name", "category", "description", "variables", "active", "version")
VALUES (
  'cart-abandoned',
  'Panier abandonné',
  'automation',
  'Envoyé 1h après abandon panier checkout (via automation cart-abandoned-1h).',
  '[
    {"name":"firstName","type":"dynamic","required":true,"label":"Prénom","sample":"Souheila"},
    {"name":"cartItemsLabel","type":"text","required":true,"label":"Items du panier","sample":"2 × Sérum lumière"},
    {"name":"resumeUrl","type":"url","required":true,"label":"URL de reprise","sample":"https://femiglow-maroc.com/panier?resume=…"}
  ]'::jsonb,
  true,
  1
)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint

-- 2. Seed the cart-abandoned-1h automation (INACTIVE by default — admin
--    must toggle it on from /admin/emails/automation once they reviewed
--    the steps).
INSERT INTO "email_automation"
  ("id", "slug", "name", "trigger_type", "trigger_config", "steps", "active")
VALUES (
  '01HZW000000000000000000001',
  'cart-abandoned-1h',
  'Panier abandonné — relance H+1',
  'event',
  '{"eventName":"cart.abandoned","minIntervalSec":3600}'::jsonb,
  '[
    {"kind":"wait","durationMs":3600000,"label":"Attendre 1h après abandon"},
    {"kind":"send","template":"cart-abandoned","payloadKeys":["firstName","cartItemsLabel","resumeUrl"],"label":"Relance H+1"}
  ]'::jsonb,
  false
)
ON CONFLICT ("slug") DO NOTHING;
