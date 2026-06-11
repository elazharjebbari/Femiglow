# Data model — schéma DB cible

> Modification minimale : la table `legal_template_vars` est étendue de 17 → 24 rows (6 renames + 7 inserts).
> Aucun changement de structure des tables. Compatible avec le schéma Drizzle existant.

## 1. Avant — schéma actuel

```sql
CREATE TABLE legal_template_vars (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  value TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17 rows existantes (cf. audit §2.2)
```

## 2. Après — schéma cible

**Structure inchangée** — seules les données changent.

### 2.1 Migration 0075

```sql
-- Migration 0075_legal_vars_rename_and_add.sql
-- CHA-LEAD-V2 — Réconcilier le naming des vars (template ↔ DB) + ajouter
-- les 7 vars manquantes.
--
-- Cf. docs/pages-legales-fix-2026-05/01-design-conception/data-model.md

-- ============================================================================
-- 1. RENAME des 6 vars qui ont un drift naming
-- ============================================================================

UPDATE legal_template_vars
   SET key = 'CONTACT_EMAIL',
       label = 'Email contact',
       updated_at = NOW()
 WHERE key = 'COMPANY_EMAIL';
--> statement-breakpoint

UPDATE legal_template_vars
   SET key = 'CONTACT_PHONE',
       label = 'Téléphone contact',
       updated_at = NOW()
 WHERE key = 'COMPANY_PHONE';
--> statement-breakpoint

UPDATE legal_template_vars
   SET key = 'HOST_ADDRESS',
       label = 'Hébergeur — adresse',
       updated_at = NOW()
 WHERE key = 'HOSTING_ADDRESS';
--> statement-breakpoint

UPDATE legal_template_vars
   SET key = 'HOST_NAME',
       label = 'Hébergeur — nom',
       updated_at = NOW()
 WHERE key = 'HOSTING_NAME';
--> statement-breakpoint

UPDATE legal_template_vars
   SET key = 'HOST_CONTACT',
       label = 'Hébergeur — contact',
       updated_at = NOW()
 WHERE key = 'HOSTING_PHONE';
--> statement-breakpoint

UPDATE legal_template_vars
   SET key = 'CNDP_DECLARATION_REF',
       label = 'CNDP — référence déclaration',
       updated_at = NOW()
 WHERE key = 'CNDP_DECLARATION';
--> statement-breakpoint

-- ============================================================================
-- 2. INSERT des 7 vars manquantes (avec valeurs par défaut sensibles)
-- ============================================================================

INSERT INTO legal_template_vars (id, key, label, description, value, is_required, sort_order, created_at, updated_at)
VALUES
  -- COOLING_OFF_DAYS : délai de rétractation (loi marocaine)
  (
    'ltv_cooling_off',
    'COOLING_OFF_DAYS',
    'Délai de rétractation (jours)',
    'Nombre de jours pour rétractation. Au Maroc : 7 jours pour la vente à distance.',
    '7',
    false,
    100,
    NOW(),
    NOW()
  ),
  -- CURRENCY : devise par défaut
  (
    'ltv_currency',
    'CURRENCY',
    'Devise',
    'Code ISO de la devise utilisée (MAD pour Maroc).',
    'MAD',
    false,
    101,
    NOW(),
    NOW()
  ),
  -- DATA_RETENTION_YEARS : durée conservation données CNDP
  (
    'ltv_data_retention',
    'DATA_RETENTION_YEARS',
    'Rétention données (années)',
    'Durée de conservation des données personnelles. CNDP recommande 3 ans après dernière interaction.',
    '3',
    false,
    102,
    NOW(),
    NOW()
  ),
  -- DELIVERY_PARTNER : nom du transporteur
  (
    'ltv_delivery_partner',
    'DELIVERY_PARTNER',
    'Partenaire livraison',
    'Nom du transporteur partenaire (ex: Amana, DHL Maroc, Aramex…).',
    '',
    true,
    103,
    NOW(),
    NOW()
  ),
  -- PAYMENT_PROVIDERS : prestataires paiement
  (
    'ltv_payment_providers',
    'PAYMENT_PROVIDERS',
    'Prestataires paiement',
    'Liste des prestataires de paiement utilisés (CMI, Inwi Money, etc.).',
    'CMI',
    false,
    104,
    NOW(),
    NOW()
  ),
  -- SUPPORT_HOURS : horaires support client
  (
    'ltv_support_hours',
    'SUPPORT_HOURS',
    'Horaires support',
    'Plage horaire du support client (format libre).',
    'Lundi-Vendredi 9h-18h (heure marocaine)',
    false,
    105,
    NOW(),
    NOW()
  )
  -- VERSION : pas inséré ici — sera un preset auto (cf. vars.ts)
ON CONFLICT (key) DO NOTHING;
--> statement-breakpoint

-- ============================================================================
-- 3. Optionnel : marquer vars inutilisées en is_required=false
-- ============================================================================

UPDATE legal_template_vars
   SET is_required = false,
       updated_at = NOW()
 WHERE key IN ('COMPANY_PATENTE', 'COMPANY_TVA', 'DPO_EMAIL')
   AND is_required = true;
--> statement-breakpoint

-- ============================================================================
-- 4. Audit post-migration (à exécuter manuellement après migrate)
-- ============================================================================

-- Vérifier que les 6 vars ont bien été renommées :
-- SELECT key FROM legal_template_vars WHERE key IN
--   ('CONTACT_EMAIL', 'CONTACT_PHONE', 'HOST_ADDRESS', 'HOST_NAME',
--    'HOST_CONTACT', 'CNDP_DECLARATION_REF');
-- Attendu : 6 rows

-- Vérifier que les 7 vars nouvelles existent :
-- SELECT key FROM legal_template_vars WHERE key IN
--   ('COOLING_OFF_DAYS', 'CURRENCY', 'DATA_RETENTION_YEARS', 'DELIVERY_PARTNER',
--    'PAYMENT_PROVIDERS', 'SUPPORT_HOURS');
-- Attendu : 6 rows (VERSION est preset, pas en DB)

-- Vérifier qu'aucune var legacy ne traîne :
-- SELECT key FROM legal_template_vars WHERE key IN
--   ('COMPANY_EMAIL', 'COMPANY_PHONE', 'HOSTING_ADDRESS', 'HOSTING_NAME',
--    'HOSTING_PHONE', 'CNDP_DECLARATION');
-- Attendu : 0 rows
```

## 3. État final attendu — 23 vars

| key | label | is_required | default value |
|---|---|---|---|
| `CNDP_DECLARATION_REF` (renamed) | CNDP — référence déclaration | ✅ | preserved |
| `COMPANY_ADDRESS` | Adresse siège | ✅ | preserved |
| `COMPANY_CAPITAL` | Capital social | ❌ | preserved |
| `COMPANY_FORM` | Forme juridique | ✅ | preserved |
| `COMPANY_NAME` | Nom légal | ❌ | preserved |
| `COMPANY_PATENTE` | Numéro patente | ❌ (was ❌) | preserved |
| `COMPANY_RC` | RC | ✅ | preserved |
| `COMPANY_TVA` | Numéro TVA | ❌ (was ❌) | preserved |
| `CONTACT_EMAIL` (renamed) | Email contact | ✅ | preserved |
| `CONTACT_PHONE` (renamed) | Téléphone contact | ✅ | preserved |
| `COOLING_OFF_DAYS` ✨ | Délai rétractation | ❌ | `7` |
| `CURRENCY` ✨ | Devise | ❌ | `MAD` |
| `DATA_RETENTION_YEARS` ✨ | Rétention données | ❌ | `3` |
| `DELIVERY_PARTNER` ✨ | Partenaire livraison | ✅ | `` (à remplir) |
| `DIRECTOR_NAME` | Directeur publication | ✅ | preserved |
| `DPO_EMAIL` | Email DPO | ❌ (was ✅) | preserved |
| `HOST_ADDRESS` (renamed) | Hébergeur — adresse | ✅ | preserved |
| `HOST_CONTACT` (renamed) | Hébergeur — contact | ❌ (was ❌) | preserved |
| `HOST_NAME` (renamed) | Hébergeur — nom | ✅ | preserved |
| `ICE` | ICE | ✅ | preserved |
| `LAST_UPDATED` | Dernière maj | ✅ | preserved |
| `PAYMENT_PROVIDERS` ✨ | Prestataires paiement | ❌ | `CMI` |
| `SUPPORT_HOURS` ✨ | Horaires support | ❌ | `Lundi-Vendredi 9h-18h…` |

## 4. Drizzle schema (inchangé)

**Fichier** : `apps/web/src/lib/db/schema.ts` (la table `legal_template_vars` existante reste identique).

Aucune modification Drizzle nécessaire — seules les rows changent.

## 5. Cleanup pages E2E orphelines

```sql
-- À exécuter une fois post-migration (ou via cron weekly)
-- Identifie les pages test E2E créées il y a > 7 jours
SELECT slug, status, created_at,
       EXTRACT(DAY FROM NOW() - created_at) AS age_days
  FROM legal_pages
 WHERE slug LIKE 'e2e-test-%'
   AND status = 'draft'
   AND created_at < NOW() - INTERVAL '7 days'
 ORDER BY created_at;

-- Soft delete via archive (préférable au DELETE hard)
UPDATE legal_pages
   SET status = 'archived',
       updated_at = NOW()
 WHERE slug LIKE 'e2e-test-%'
   AND status = 'draft'
   AND created_at < NOW() - INTERVAL '7 days';

-- OR DELETE hard si on est sûr (recommandé pour pages E2E)
-- D'abord vérifier qu'aucun history n'est attaché :
SELECT COUNT(*) FROM legal_pages_history h
  JOIN legal_pages p ON p.id = h.page_id
 WHERE p.slug LIKE 'e2e-test-%';
-- Si 0 : OK pour DELETE

DELETE FROM legal_pages
 WHERE slug LIKE 'e2e-test-%'
   AND status = 'draft'
   AND created_at < NOW() - INTERVAL '7 days';
```

## 6. Constants TypeScript

**Fichier nouveau** : `apps/web/src/lib/legal/known-vars.ts`

```ts
/**
 * LEGAL-V2 — Liste des vars connues + leur classification.
 *
 * Utile pour :
 *  - Test d'invariant (toutes les vars utilisées sont définies)
 *  - Doc auto-générée
 *  - Suggestions UI
 */

/** Variables stockées en DB (`legal_template_vars`). */
export const DB_VAR_KEYS = [
  // Identité entreprise
  'COMPANY_NAME',
  'COMPANY_FORM',
  'COMPANY_RC',
  'COMPANY_ADDRESS',
  'COMPANY_CAPITAL',
  'COMPANY_PATENTE',
  'COMPANY_TVA',
  'ICE',
  // Contact
  'CONTACT_EMAIL',
  'CONTACT_PHONE',
  // Hébergement
  'HOST_NAME',
  'HOST_ADDRESS',
  'HOST_CONTACT',
  // Conformité
  'CNDP_DECLARATION_REF',
  'DPO_EMAIL',
  'DIRECTOR_NAME',
  // Commercial / business
  'COOLING_OFF_DAYS',
  'CURRENCY',
  'DATA_RETENTION_YEARS',
  'DELIVERY_PARTNER',
  'PAYMENT_PROVIDERS',
  'SUPPORT_HOURS',
  // Dates
  'LAST_UPDATED',
] as const;

export type DbVarKey = (typeof DB_VAR_KEYS)[number];

/** Variables presets (calculées au runtime, pas en DB). */
export const PRESET_VAR_KEYS = [
  'LAST_UPDATED', // peut être preset ou DB (preset prioritaire)
  'CURRENT_YEAR',
  'SITE_URL',
  'VERSION', // ✨ NEW
] as const;

export type PresetVarKey = (typeof PRESET_VAR_KEYS)[number];

/** Toutes les vars connues. */
export const ALL_KNOWN_VARS = [...new Set([...DB_VAR_KEYS, ...PRESET_VAR_KEYS])] as const;

/** Variables sensibles à anonymiser dans les templates publics. */
export const SENSITIVE_VARS: ReadonlyArray<DbVarKey> = [
  'ICE',
  'COMPANY_RC',
  'COMPANY_ADDRESS',
  'COMPANY_FORM',
  'COMPANY_CAPITAL',
  'DIRECTOR_NAME',
];
```

## 7. Rollback de la migration

Si on doit annuler :

```sql
-- Step 1 : désactiver le flag pour ne plus utiliser nouveau naming
-- Set LEGAL_VARS_V2=false, redéployer

-- Step 2 : reverse rename
UPDATE legal_template_vars SET key = 'COMPANY_EMAIL', label = 'Email contact'
 WHERE key = 'CONTACT_EMAIL';
UPDATE legal_template_vars SET key = 'COMPANY_PHONE', label = 'Téléphone'
 WHERE key = 'CONTACT_PHONE';
UPDATE legal_template_vars SET key = 'HOSTING_ADDRESS', label = 'Hébergeur — adresse'
 WHERE key = 'HOST_ADDRESS';
UPDATE legal_template_vars SET key = 'HOSTING_NAME', label = 'Hébergeur — nom'
 WHERE key = 'HOST_NAME';
UPDATE legal_template_vars SET key = 'HOSTING_PHONE', label = 'Hébergeur — téléphone'
 WHERE key = 'HOST_CONTACT';
UPDATE legal_template_vars SET key = 'CNDP_DECLARATION', label = 'CNDP — déclaration'
 WHERE key = 'CNDP_DECLARATION_REF';

-- Step 3 : supprimer les vars ajoutées
DELETE FROM legal_template_vars
 WHERE key IN ('COOLING_OFF_DAYS', 'CURRENCY', 'DATA_RETENTION_YEARS',
               'DELIVERY_PARTNER', 'PAYMENT_PROVIDERS', 'SUPPORT_HOURS');
```

⚠️ **Important** : le rollback nécessite aussi de re-publier les pages templates v1 (qui utilisaient le legacy naming) via `legal_pages_history` restore.

## 8. Estimation impact

- **Durée migration** : < 1s (UPDATEs sur 6 rows + INSERTs sur 6 rows)
- **Lock** : aucun lock long, table peu fréquentée
- **Espace** : aucun changement notable
- **Indices** : aucun nouvel index requis (la table n'a que `id` PK + `key` UNIQUE)
