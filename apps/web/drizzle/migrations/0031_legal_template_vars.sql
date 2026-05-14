-- ===========================================================================
-- Migration 0031 — Legal template vars
-- ---------------------------------------------------------------------------
-- Key/value store des variables substituées dans le contenu MD ({{COMPANY_RC}},
-- {{ICE}}, …). 17 vars par défaut, certaines avec une valeur initiale FemiGlow
-- (siège Patrice Lumumba, email, téléphone), d'autres laissées vides à remplir
-- par l'admin avant publish.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "legal_template_vars" (
  "key"           text PRIMARY KEY
    CHECK (key ~ '^[A-Z][A-Z0-9_]*$' AND length(key) BETWEEN 2 AND 40),
  "value"         text CHECK (value IS NULL OR length(value) <= 1000),
  "label"         text NOT NULL,
  "description"   text,
  "is_required"   boolean NOT NULL DEFAULT TRUE,
  "sensitive"     boolean NOT NULL DEFAULT FALSE,
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by"    text REFERENCES "admin_users"("id") ON DELETE SET NULL
);

INSERT INTO "legal_template_vars" ("key", "value", "label", "description", "is_required", "sensitive") VALUES
  ('COMPANY_NAME',     'FemiGlow',                                              'Nom légal',                'Dénomination sociale complète',                FALSE, FALSE),
  ('COMPANY_FORM',     '',                                                      'Forme juridique',          'SARL AU / EI / SA / ...',                      TRUE,  FALSE),
  ('COMPANY_CAPITAL',  '',                                                      'Capital social',           'Montant en MAD (sociétés)',                    FALSE, FALSE),
  ('COMPANY_ADDRESS',  '25 bis avenue Patrice Lumumba, Rabat, Maroc',           'Adresse siège',            'Adresse complète',                             TRUE,  FALSE),
  ('COMPANY_RC',       '',                                                      'RC (Registre Commerce)',   'Format : numéro/ville',                        TRUE,  FALSE),
  ('ICE',              '',                                                      'ICE',                      'Identifiant Commun Entreprise (15 chiffres)',  TRUE,  FALSE),
  ('COMPANY_PATENTE',  '',                                                      'Numéro patente',           'Numéro de patente (taxe pro)',                 FALSE, FALSE),
  ('COMPANY_TVA',      '',                                                      'Numéro TVA',               'Si assujetti à la TVA',                        FALSE, FALSE),
  ('COMPANY_EMAIL',    'info@femiglow-maroc.com',                               'Email contact',            'Email général',                                TRUE,  FALSE),
  ('COMPANY_PHONE',    '+212 630-035905',                                       'Téléphone',                'Numéro de contact (+212...)',                  TRUE,  FALSE),
  ('DIRECTOR_NAME',    'Sara Jebbari',                                          'Directeur publication',    'Personne responsable',                         TRUE,  FALSE),
  ('HOSTING_NAME',     '',                                                      'Hébergeur — nom',          'Nom de la société d''hébergement',             TRUE,  FALSE),
  ('HOSTING_ADDRESS',  '',                                                      'Hébergeur — adresse',      'Adresse de l''hébergeur',                      TRUE,  FALSE),
  ('HOSTING_PHONE',    '',                                                      'Hébergeur — téléphone',    'Téléphone hébergeur',                          FALSE, FALSE),
  ('DPO_EMAIL',        'privacy@femiglow-maroc.com',                            'Email DPO',                'Délégué Protection Données',                   TRUE,  FALSE),
  ('CNDP_DECLARATION', 'en cours',                                              'CNDP — déclaration',       'Numéro déclaration CNDP ou "en cours"',        TRUE,  FALSE),
  ('LAST_UPDATED',     '13 mai 2026',                                           'Dernière mise à jour',     'Date format français',                         TRUE,  FALSE)
ON CONFLICT ("key") DO NOTHING;
