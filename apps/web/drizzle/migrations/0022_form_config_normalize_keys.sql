-- CHA-230 — Normalise les clés JSONB du form_config en camelCase pour
-- correspondre au schema Zod (cf. apps/web/src/lib/checkout/form-config/schema.ts).
--
-- Mappings :
--   defaults.form_mode        → defaults.formMode
--   defaults.payment_methods  → defaults.paymentMethods
--
-- Les autres clés (validation.phone_min_length, copy.cta_lead, …) restent
-- en snake_case — c'est cohérent avec le schema (les sous-objets `copy` /
-- `validation` utilisent volontairement snake_case car ils sont plus
-- proches du JSON d'export GTM/API publique).
--
-- Idempotent : si la clé snake_case n'existe pas (déjà migrée), no-op.

UPDATE form_config
SET config = jsonb_set(
  jsonb_set(
    config #- '{defaults,form_mode}' #- '{defaults,payment_methods}',
    '{defaults,formMode}',
    config #> '{defaults,form_mode}'
  ),
  '{defaults,paymentMethods}',
  config #> '{defaults,payment_methods}'
)
WHERE config #> '{defaults,form_mode}' IS NOT NULL
   OR config #> '{defaults,payment_methods}' IS NOT NULL;

-- Ajoute defaults.defaultShippingMode si absent (default 'standard').
UPDATE form_config
SET config = jsonb_set(
  config,
  '{defaults,defaultShippingMode}',
  '"standard"'::jsonb
)
WHERE NOT (config #> '{defaults,defaultShippingMode}' IS NOT NULL);

-- Note : on n'insère PAS de ligne d'audit dans `form_config_history` ici
-- pour ne pas violer la contrainte UNIQUE(form_config_id, version) — la
-- version actuelle (v1 seedée) reste valide, on normalise juste les
-- clés. L'audit applicatif futur incrémente version → trace propre.
