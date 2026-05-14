-- 0029_emailing_seed — idempotent seed for email_template_meta.
--
-- The actual template *components* live in code (lib/mail/templates/*.tsx) and
-- are exposed via lib/mail/catalog.ts in-memory registry. This table stores
-- runtime metadata: active flag, version, lastUsedAt, listmonkTemplateId.
--
-- Re-run safe : ON CONFLICT DO NOTHING. To bump a version after a template
-- change, write a follow-up migration (don't UPDATE here, history matters).
--
-- Cf. docs/emailing/07-templates-system.md §2.

INSERT INTO "email_template_meta"
  ("slug", "display_name", "category", "description", "variables", "active", "version")
VALUES
  ('contact-acknowledgement',
   'Accusé de contact',
   'transactional',
   'Envoyé après soumission du formulaire de contact.',
   '[
     {"name":"firstName","type":"dynamic","required":true,"label":"Prénom","sample":"Souheila"},
     {"name":"messageExcerpt","type":"text","required":true,"label":"Extrait message","sample":"..."}
   ]'::jsonb,
   true,
   1),
  ('order-confirmation',
   'Confirmation de commande',
   'transactional',
   'Envoyé immédiatement après création d''une commande validée.',
   '[
     {"name":"firstName","type":"dynamic","required":true,"label":"Prénom","sample":"Souheila"},
     {"name":"orderId","type":"text","required":true,"label":"N° commande","sample":"FG-20260513-001"},
     {"name":"orderTotal","type":"text","required":true,"label":"Total","sample":"390 MAD"},
     {"name":"itemsCount","type":"number","required":true,"label":"Nombre d''articles","sample":"2"},
     {"name":"deliveryEstimate","type":"text","required":true,"label":"Délai livraison","sample":"2-4 jours"}
   ]'::jsonb,
   true,
   1)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint

-- Initialize the singleton `email_settings.global` row if absent.
INSERT INTO "email_settings" ("key", "json")
VALUES ('global', '{
  "footer_html": "FemiGlow · Rabat, Maroc · femiglow-maroc.com",
  "from_label": "FemiGlow",
  "test_recipient": null
}'::jsonb)
ON CONFLICT ("key") DO NOTHING;
