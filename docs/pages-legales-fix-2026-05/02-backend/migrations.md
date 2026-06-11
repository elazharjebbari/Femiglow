# Migration SQL

## 1. Migration `0075_legal_vars_rename_and_add.sql`

**Fichier** : `apps/web/drizzle/migrations/0075_legal_vars_rename_and_add.sql`

Contenu complet :

```sql
-- ============================================================================
-- LEGAL-V2-01 — Réconcilier le naming des variables legal_template_vars.
--
-- Symptômes :
--  - Templates utilisent {{CONTACT_EMAIL}} mais DB définit COMPANY_EMAIL
--  - 6 paires drift + 7 vars manquantes
--
-- Effet :
--  - Renomme 6 vars existantes (préserve les valeurs)
--  - INSERT 6 nouvelles vars avec valeurs par défaut sensibles
--    (VERSION sera un preset auto, pas en DB)
--  - Marque is_required=false sur vars inutilisées
--
-- Réversibilité :
--  - Rollback SQL fourni en commentaire bas de fichier
--  - Feature flag LEGAL_VARS_V2 permet de ne pas utiliser le nouveau naming
--    si on veut revert sans recreate la DB
--
-- Cf. docs/pages-legales-fix-2026-05/01-design-conception/data-model.md
-- ============================================================================

-- 1. Rename des 6 vars drift
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

-- 2. INSERT des 6 vars manquantes (VERSION sera un preset, pas en DB)
INSERT INTO legal_template_vars (id, key, label, description, value, is_required, sort_order, created_at, updated_at)
VALUES
  ('ltv_cool_off', 'COOLING_OFF_DAYS', 'Délai de rétractation (jours)',
   'Nombre de jours pour rétractation. Au Maroc : 7 jours pour la vente à distance.',
   '7', false, 100, NOW(), NOW()),
  ('ltv_currency', 'CURRENCY', 'Devise',
   'Code ISO de la devise utilisée (MAD pour Maroc).',
   'MAD', false, 101, NOW(), NOW()),
  ('ltv_data_ret', 'DATA_RETENTION_YEARS', 'Rétention données (années)',
   'Durée de conservation des données personnelles. CNDP recommande 3 ans.',
   '3', false, 102, NOW(), NOW()),
  ('ltv_delivery', 'DELIVERY_PARTNER', 'Partenaire livraison',
   'Nom du transporteur partenaire (Amana, DHL Maroc, Aramex...).',
   '', true, 103, NOW(), NOW()),
  ('ltv_payment', 'PAYMENT_PROVIDERS', 'Prestataires paiement',
   'Liste des prestataires de paiement utilisés.',
   'CMI', false, 104, NOW(), NOW()),
  ('ltv_support', 'SUPPORT_HOURS', 'Horaires support',
   'Plage horaire du support client (format libre).',
   'Lundi-Vendredi 9h-18h (heure marocaine)', false, 105, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;
--> statement-breakpoint

-- 3. Marquer vars inutilisées comme non-requises
UPDATE legal_template_vars
   SET is_required = false,
       updated_at = NOW()
 WHERE key IN ('COMPANY_PATENTE', 'COMPANY_TVA', 'DPO_EMAIL')
   AND is_required = true;
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
```

## 2. Application

```bash
cd apps/web

# Génération de la migration via Drizzle (vérifier qu'elle est bien créée)
# Ou édition manuelle du fichier ci-dessus

# Migration locale
pnpm db:migrate-safe

# Vérification post-migration
psql $DATABASE_URL -c "SELECT key, is_required, value IS NOT NULL AND value != '' AS filled FROM legal_template_vars ORDER BY key;"
```

## 3. Vérifications post-migration

### 3.1 Vars renommées

```sql
-- Doit retourner 6 rows
SELECT key FROM legal_template_vars
 WHERE key IN ('CONTACT_EMAIL', 'CONTACT_PHONE', 'HOST_ADDRESS', 'HOST_NAME',
               'HOST_CONTACT', 'CNDP_DECLARATION_REF');
```

### 3.2 Vars ajoutées

```sql
-- Doit retourner 6 rows
SELECT key FROM legal_template_vars
 WHERE key IN ('COOLING_OFF_DAYS', 'CURRENCY', 'DATA_RETENTION_YEARS',
               'DELIVERY_PARTNER', 'PAYMENT_PROVIDERS', 'SUPPORT_HOURS');
```

### 3.3 Vars legacy disparues

```sql
-- Doit retourner 0 rows
SELECT key FROM legal_template_vars
 WHERE key IN ('COMPANY_EMAIL', 'COMPANY_PHONE', 'HOSTING_ADDRESS', 'HOSTING_NAME',
               'HOSTING_PHONE', 'CNDP_DECLARATION');
```

### 3.4 Aucune valeur perdue

```sql
-- Comparer avant/après le nombre de vars non vides
SELECT COUNT(*) FROM legal_template_vars WHERE value IS NOT NULL AND value != '';
-- Doit être >= au count pré-migration
```

### 3.5 Drift cleared

```sql
-- Audit drift : toutes les vars utilisées dans body_md doivent exister en DB
WITH used AS (
  SELECT DISTINCT regexp_matches(body_md, '\{\{([A-Z][A-Z0-9_]*)\}\}', 'g') AS m
  FROM legal_pages WHERE slug NOT LIKE 'e2e%'
)
SELECT u.m[1] AS used_var,
       v.key IS NOT NULL AS defined_in_db,
       u.m[1] IN ('LAST_UPDATED', 'CURRENT_YEAR', 'SITE_URL', 'VERSION') AS is_preset
FROM used u LEFT JOIN legal_template_vars v ON v.key = u.m[1]
ORDER BY u.m[1];
```

Attendu : toutes les rows ont `defined_in_db = true` OU `is_preset = true`. Aucune ligne avec les deux à `false`.

## 4. Cleanup E2E orphelins (migration data séparée)

**Optionnel** : peut être appliqué via le endpoint `DELETE /api/admin/legal/cleanup-e2e` plutôt qu'en migration.

```sql
-- À exécuter une fois après audit pour nettoyer la DB locale + staging
-- Lister d'abord pour vérifier
SELECT slug, status, created_at, age(created_at) AS age
  FROM legal_pages
 WHERE slug LIKE 'e2e-test-%'
   AND status = 'draft'
 ORDER BY created_at;

-- Si OK, supprimer
DELETE FROM legal_pages
 WHERE slug LIKE 'e2e-test-%'
   AND status = 'draft'
   AND created_at < NOW() - INTERVAL '7 days';
```

## 5. Script TypeScript alternatif

**Fichier nouveau** : `apps/web/scripts/legal-vars-rename.ts`

Pour environnements où on ne peut pas exécuter du SQL brut (debug local) :

```ts
/**
 * LEGAL-V2-01 — Rename des vars DB (alternative TypeScript à la migration SQL).
 *
 * Usage :
 *   pnpm tsx scripts/legal-vars-rename.ts --dry-run
 *   pnpm tsx scripts/legal-vars-rename.ts --execute
 */
import './_load-env.mjs';
import { eq } from 'drizzle-orm';

import { db, schema } from '@/lib/db/client';

const RENAMES: ReadonlyArray<{ from: string; to: string; label?: string }> = [
  { from: 'COMPANY_EMAIL', to: 'CONTACT_EMAIL', label: 'Email contact' },
  { from: 'COMPANY_PHONE', to: 'CONTACT_PHONE', label: 'Téléphone contact' },
  { from: 'HOSTING_ADDRESS', to: 'HOST_ADDRESS', label: 'Hébergeur — adresse' },
  { from: 'HOSTING_NAME', to: 'HOST_NAME', label: 'Hébergeur — nom' },
  { from: 'HOSTING_PHONE', to: 'HOST_CONTACT', label: 'Hébergeur — contact' },
  { from: 'CNDP_DECLARATION', to: 'CNDP_DECLARATION_REF', label: 'CNDP — référence déclaration' },
];

async function main() {
  const dryRun = !process.argv.includes('--execute');
  const conn = db();
  if (!conn) throw new Error('DATABASE_URL required');

  console.log(`\n🔧 Legal vars rename — ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  for (const r of RENAMES) {
    const matches = await conn
      .select()
      .from(schema.legalTemplateVars)
      .where(eq(schema.legalTemplateVars.key, r.from))
      .limit(1);
    if (matches.length === 0) {
      console.log(`  ⏭️  ${r.from} → ${r.to} (not found, skip)`);
      continue;
    }
    console.log(`  ${dryRun ? '🔍' : '✏️ '} ${r.from} → ${r.to}`);
    if (!dryRun) {
      await conn.update(schema.legalTemplateVars)
        .set({ key: r.to, label: r.label ?? matches[0].label, updatedAt: new Date() })
        .where(eq(schema.legalTemplateVars.key, r.from));
    }
  }

  if (dryRun) console.log('\n💡 Use --execute to apply.\n');
  else console.log('\n✅ Done.\n');
  process.exit(0);
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
```

## 6. Durée estimée

- **Migration locale (sur DB Postgres locale)** : < 100ms
- **Migration staging Neon** : < 500ms
- **Migration prod Neon** : < 500ms
- **Lock** : aucun (table très petite ~24 rows)
- **Espace** : pas de changement notable
