# Seed des traductions — stratégie initiale et fixtures

> Comment seeder les locales et les premières traductions FemiGlow dans `i18n_locales`, `messages/[locale].json`, et les tables CMS existantes. Idempotent, env-aware, testable.

## 1. Vue d'ensemble du seeding

Le seed i18n FemiGlow se décompose en **5 étapes** indépendantes :

| # | Étape | Cible | Outil | Durée |
|---|---|---|---|---|
| 1 | Seed `i18n_locales` (fr, ar, en) | DB | `seed-i18n.ts` | < 1 s |
| 2 | Seed `messages/fr.json` initial | JSON file | extract-strings.ts (cf. content-extraction.md) | manuelle (1 sprint) |
| 3 | Backfill `component_field_bindings` (FR forcé) | DB | `seed-i18n.ts` partie 2 | 5 s |
| 4 | Backfill `legal_pages` (FR forcé) | DB | `seed-i18n.ts` partie 3 | < 1 s |
| 5 | Génération fixtures tests | Helpers Vitest | `i18n-factories.ts` (test) | N/A |

Le script principal `apps/web/scripts/seed-i18n.ts` orchestre les étapes 1, 3, 4 (les étapes 2 et 5 sont manuelles ou dans le code de test).

## 2. Pré-requis avant seed

### 2.1 Prérequis techniques

- [ ] Migration `0076_i18n_locales.sql` appliquée (cf. `translation-tables.sql`)
- [ ] Variable `DATABASE_URL` pointée vers la DB cible (dev / staging / prod)
- [ ] Node 22+, pnpm 9+
- [ ] `apps/web/messages/` directory créé

### 2.2 Prérequis fonctionnels

- [ ] Liste des locales V1 confirmée (fr, ar, en)
- [ ] Currency unique confirmée (MAD pour les 3 V1)
- [ ] Direction confirmée (fr=ltr, ar=rtl, en=ltr)
- [ ] Fallback chain confirmée (ar→fr, en→fr, fr→null)

## 3. Ordre des locales — pourquoi FR d'abord

L'ordre du seed est **important** car les autres locales référencent `fr` comme `fallback_locale` :

```
1. fr  (default, fallback=NULL, enabled=true, is_default=true)
2. ar  (fallback='fr', enabled=true, RTL)
3. en  (fallback='fr', enabled=false initialement → activation Phase 5)
```

Si on tentait d'insérer `ar` avant `fr`, la FK `fallback_locale → i18n_locales(code)` échouerait.

Le script `seed-i18n.ts` respecte cet ordre par `sort_order` ASC.

## 4. Le script `seed-i18n.ts`

### 4.1 Structure (référence — ne pas créer dans apps/web sans GO)

Localisation prévue : `apps/web/scripts/seed-i18n.ts`

```ts
/**
 * Seed i18n locales + backfill tables existantes
 *
 * Idempotent : safe re-run sur la même DB.
 * Env-aware : prod vs staging vs dev avec checks différents.
 *
 * Usage :
 *   pnpm exec tsx apps/web/scripts/seed-i18n.ts --env=dev
 *   pnpm exec tsx apps/web/scripts/seed-i18n.ts --env=prod --confirm
 *
 * Options :
 *   --env=<dev|staging|prod>  Environnement cible (default: dev)
 *   --confirm                 Requis pour prod (sinon dry-run)
 *   --skip-backfill           Skip étapes 3 et 4 (utile pour CI tests)
 *   --verbose                 Log détaillé
 */

import { db } from '@/lib/db';
import {
  i18nLocales,
  componentFieldBindings,
  legalPages,
  seoOverrides,
} from '@/lib/db/schema';
import { sql, eq, or, isNull } from 'drizzle-orm';
import { parseArgs } from 'node:util';

interface SeedOptions {
  env: 'dev' | 'staging' | 'prod';
  confirm: boolean;
  skipBackfill: boolean;
  verbose: boolean;
}

const LOCALES_SEED = [
  {
    code: 'fr',
    displayName: 'French',
    displayNameNative: 'Français',
    direction: 'ltr' as const,
    flagEmoji: '🇫🇷',
    fallbackLocale: null,
    dateFormat: 'dd MMM yyyy',
    numberFormat: 'fr-FR',
    currencyCode: 'MAD',
    enabled: true,
    isDefault: true,
    sortOrder: 10,
  },
  {
    code: 'ar',
    displayName: 'Arabic',
    displayNameNative: 'العربية',
    direction: 'rtl' as const,
    flagEmoji: '🇲🇦',
    fallbackLocale: 'fr',
    dateFormat: 'dd MMM yyyy',
    numberFormat: 'ar-MA',
    currencyCode: 'MAD',
    enabled: true,
    isDefault: false,
    sortOrder: 20,
  },
  {
    code: 'en',
    displayName: 'English',
    displayNameNative: 'English',
    direction: 'ltr' as const,
    flagEmoji: '🇬🇧',
    fallbackLocale: 'fr',
    dateFormat: 'MMM dd, yyyy',
    numberFormat: 'en-US',
    currencyCode: 'MAD',
    enabled: false,        // Désactivé V1 — sera activé Phase 5
    isDefault: false,
    sortOrder: 30,
  },
];

async function main(opts: SeedOptions) {
  log(opts, 'Seed i18n démarré', { env: opts.env, confirm: opts.confirm });

  // Production : exiger --confirm
  if (opts.env === 'prod' && !opts.confirm) {
    log(opts, 'Mode dry-run prod — pas d\'écriture. Passer --confirm pour appliquer.');
    return;
  }

  // ÉTAPE 1 — Seed i18n_locales
  await seedLocales(opts);

  // ÉTAPE 3 — Backfill component_field_bindings (skip si demandé)
  if (!opts.skipBackfill) {
    await backfillBindings(opts);
  }

  // ÉTAPE 4 — Backfill legal_pages
  if (!opts.skipBackfill) {
    await backfillLegalPages(opts);
  }

  // ÉTAPE 4 bis — Backfill seo_overrides
  if (!opts.skipBackfill) {
    await backfillSeoOverrides(opts);
  }

  log(opts, 'Seed i18n terminé avec succès');
}

async function seedLocales(opts: SeedOptions) {
  log(opts, 'Étape 1: Seed i18n_locales');

  // Trier par sort_order pour respecter dépendance FK fallback_locale
  const sorted = [...LOCALES_SEED].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const locale of sorted) {
    const existing = await db
      .select()
      .from(i18nLocales)
      .where(eq(i18nLocales.code, locale.code))
      .limit(1);

    if (existing.length > 0) {
      log(opts, `  - ${locale.code} déjà présent — skip`);
      continue;
    }

    await db.insert(i18nLocales).values(locale);
    log(opts, `  + ${locale.code} inséré (${locale.displayNameNative}, ${locale.direction})`);
  }
}

async function backfillBindings(opts: SeedOptions) {
  log(opts, 'Étape 3: Backfill component_field_bindings.locale=fr si NULL');
  const result = await db
    .update(componentFieldBindings)
    .set({ locale: 'fr' })
    .where(or(
      isNull(componentFieldBindings.locale),
      eq(componentFieldBindings.locale, ''),
    ));
  log(opts, `  ${result.rowCount ?? 0} bindings backfilled`);
}

async function backfillLegalPages(opts: SeedOptions) {
  log(opts, 'Étape 4: Backfill legal_pages.locale=fr si NULL');
  const result = await db
    .update(legalPages)
    .set({ locale: 'fr' })
    .where(or(
      isNull(legalPages.locale),
      eq(legalPages.locale, ''),
    ));
  log(opts, `  ${result.rowCount ?? 0} legal_pages backfilled`);
}

async function backfillSeoOverrides(opts: SeedOptions) {
  log(opts, 'Étape 4 bis: Backfill seo_overrides.locale=fr si NULL');
  const result = await db
    .update(seoOverrides)
    .set({ locale: 'fr' })
    .where(or(
      isNull(seoOverrides.locale),
      eq(seoOverrides.locale, ''),
    ));
  log(opts, `  ${result.rowCount ?? 0} seo_overrides backfilled`);
}

function log(opts: SeedOptions, msg: string, meta?: Record<string, unknown>) {
  if (opts.verbose || meta) {
    console.log(`[seed-i18n] ${msg}`, meta ?? '');
  } else {
    console.log(`[seed-i18n] ${msg}`);
  }
}

// CLI bootstrap
const { values } = parseArgs({
  options: {
    env: { type: 'string', default: 'dev' },
    confirm: { type: 'boolean', default: false },
    'skip-backfill': { type: 'boolean', default: false },
    verbose: { type: 'boolean', default: false },
  },
});

main({
  env: (values.env as SeedOptions['env']) ?? 'dev',
  confirm: values.confirm ?? false,
  skipBackfill: values['skip-backfill'] ?? false,
  verbose: values.verbose ?? false,
}).catch((err) => {
  console.error('[seed-i18n] ÉCHEC', err);
  process.exit(1);
});
```

### 4.2 Commandes pnpm associées

À ajouter dans `apps/web/package.json` :

```json
{
  "scripts": {
    "seed:i18n": "tsx scripts/seed-i18n.ts --env=dev --verbose",
    "seed:i18n:staging": "tsx scripts/seed-i18n.ts --env=staging --confirm",
    "seed:i18n:prod": "tsx scripts/seed-i18n.ts --env=prod --confirm"
  }
}
```

### 4.3 Comportement par environnement

| Env | Behaviour par défaut | --confirm requis | Backfill | Logs |
|---|---|---|---|---|
| `dev` | Insert direct | Non | Oui | Verbose |
| `staging` | Insert direct (mais snapshot DB conseillé avant) | Non | Oui | Verbose |
| `prod` | Dry-run par défaut. `--confirm` pour écrire | **Oui** | Oui (idempotent) | Erreur si conflits FK |

## 5. Idempotence — re-run safe

Le seed est conçu pour être re-runnable sans dommage :

### 5.1 Pour `i18n_locales`

```ts
// Vérification existence avant insert
const existing = await db.select().from(i18nLocales).where(eq(i18nLocales.code, code));
if (existing.length > 0) continue;
await db.insert(i18nLocales).values(...);
```

Alternative SQL pure dans `translation-tables.sql` :

```sql
INSERT INTO i18n_locales (...) VALUES (...)
ON CONFLICT (code) DO NOTHING;
```

### 5.2 Pour les backfills

L'UPDATE est conditionné par `WHERE locale IS NULL OR locale = ''`. Re-run : 0 lignes affectées car déjà à 'fr'.

### 5.3 Pas de mise à jour de config existante

⚠️ Important : **le seed ne modifie PAS** une locale déjà présente. Si on veut changer `enabled` ou `display_name`, passer par :

```bash
# Mode update explicite
pnpm exec tsx apps/web/scripts/seed-i18n.ts --update --code=en --enabled=true
```

(Pas dans le scope V1 — passer par admin UI plutôt.)

## 6. Seeds par environnement

### 6.1 Dev local

```bash
# 1. DB locale up
docker compose up -d postgres

# 2. Migrations
pnpm db:migrate

# 3. Seed i18n
pnpm seed:i18n

# Output attendu :
# [seed-i18n] Seed i18n démarré { env: 'dev', confirm: false }
# [seed-i18n] Étape 1: Seed i18n_locales
# [seed-i18n]   + fr inséré (Français, ltr)
# [seed-i18n]   + ar inséré (العربية, rtl)
# [seed-i18n]   + en inséré (English, ltr)
# [seed-i18n] Étape 3: Backfill component_field_bindings.locale=fr si NULL
# [seed-i18n]   42 bindings backfilled
# [seed-i18n] Étape 4: Backfill legal_pages.locale=fr si NULL
# [seed-i18n]   9 legal_pages backfilled
# [seed-i18n] Étape 4 bis: Backfill seo_overrides.locale=fr si NULL
# [seed-i18n]   3 seo_overrides backfilled
# [seed-i18n] Seed i18n terminé avec succès
```

### 6.2 Staging

```bash
# 1. Snapshot DB
pnpm db:snapshot:staging

# 2. Migrate
DATABASE_URL=$STAGING_DB pnpm db:migrate

# 3. Seed
DATABASE_URL=$STAGING_DB pnpm seed:i18n:staging

# 4. Smoke tests
pnpm test:smoke:i18n --env=staging
```

### 6.3 Production

```bash
# 1. Backup DB (Neon snapshot ou pg_dump)
pnpm db:backup:prod -- --tag=pre-i18n-seed

# 2. Dry-run
DATABASE_URL=$PROD_DB pnpm exec tsx scripts/seed-i18n.ts --env=prod

# 3. Apply
DATABASE_URL=$PROD_DB pnpm seed:i18n:prod

# 4. Vérification
psql $PROD_DB -c "SELECT code, enabled, is_default FROM i18n_locales ORDER BY sort_order"
psql $PROD_DB -c "SELECT COUNT(*) FROM component_field_bindings WHERE locale IS NULL OR locale=''"
# Doit retourner 0

# 5. Smoke tests prod (read-only)
pnpm test:smoke:i18n --env=prod
```

## 7. Seed des `messages/[locale].json`

### 7.1 État initial cible Phase 1

```
apps/web/messages/
├── _schema.json          ← copie du translation-keys-schema.json
├── _meta.json            ← métadonnées globales (versions par locale)
├── fr.json               ← ~600-800 clés extraites (source of truth)
├── ar.json               ← {} vide ou shallow (extraction Phase 2)
└── en.json               ← {} vide ou shallow (extraction Phase 2)
```

### 7.2 Génération `fr.json` initial

**Source** : strings hardcoded dans `apps/web/src/app/` et `apps/web/src/components/`.

**Process** :

1. Lancer le script d'extraction (cf. `content-extraction.md`) :
   ```bash
   pnpm i18n:extract --target=fr --output=apps/web/messages/_extracted_pending.json
   ```

2. Le founder review le fichier `_extracted_pending.json` (~600-800 clés).

3. Validation + merge dans `messages/fr.json`.

4. Suppression du `_extracted_pending.json`.

### 7.3 Génération `ar.json` et `en.json` initiales

**Approche A (recommandée V1) — copy from FR puis traduire**

```bash
# Copy structure FR → AR (valeurs identiques temporairement)
pnpm i18n:scaffold --source=fr --target=ar
# Crée apps/web/messages/ar.json avec mêmes clés, valeurs FR comme placeholder
```

**Approche B — start vide**

```bash
# Crée AR / EN avec uniquement _meta
echo '{"_meta": {"locale": "ar", "completeness_pct": 0}}' > apps/web/messages/ar.json
```

Approche A préférée car : (i) on voit toutes les clés à traduire dans Google Sheets ; (ii) on a un fallback de qualité pendant la traduction.

### 7.4 Exemple `messages/fr.json` minimal (post-extraction)

```json
{
  "$schema": "./_schema.json",
  "_meta": {
    "locale": "fr",
    "completeness_pct": 100,
    "last_reviewed_by": "founder@femiglow.local",
    "last_reviewed_at": "2026-05-27T14:30:00Z",
    "translator_notes": "Locale source — toute modification déclenche revue AR/EN"
  },
  "common": {
    "back": "Retour",
    "continue": "Continuer",
    "loading": "Chargement…"
  },
  "navigation": {
    "home": "Accueil",
    "kit": "Le kit",
    "maison": "La maison"
  },
  "marketing": {
    "hero": {
      "title": "Le rituel ongles, en cinq minutes.",
      "subtitle": "Trois gestes, une saison."
    }
  }
}
```

## 8. Fixtures pour tests

### 8.1 Helpers Vitest

Localisation : `apps/web/src/test/factories/i18n.factory.ts`

```ts
import { Faker, fr, ar, en } from '@faker-js/faker';
import type { I18nLocale, I18nTranslationKey, I18nTranslationValue } from '@/lib/db/schema';

const fakerByLocale = {
  fr: new Faker({ locale: [fr] }),
  ar: new Faker({ locale: [ar] }),
  en: new Faker({ locale: [en] }),
};

export function buildLocale(overrides: Partial<I18nLocale> = {}): I18nLocale {
  return {
    code: 'fr',
    displayName: 'French',
    displayNameNative: 'Français',
    direction: 'ltr',
    flagEmoji: '🇫🇷',
    fallbackLocale: null,
    dateFormat: 'dd MMM yyyy',
    numberFormat: 'fr-FR',
    currencyCode: 'MAD',
    enabled: true,
    isDefault: true,
    sortOrder: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

export function buildTranslationKey(
  overrides: Partial<I18nTranslationKey> = {}
): I18nTranslationKey {
  return {
    key: 'marketing.hero.title',
    namespace: 'marketing',
    description: 'Titre principal page d\'accueil',
    context: 'src/app/(marketing)/page.tsx',
    type: 'static',
    sourceValue: 'Le rituel ongles, en cinq minutes.',
    priority: 'P0',
    extractionStatus: 'approved',
    isActive: true,
    addedAt: new Date(),
    addedBy: 'system',
    lastUsedAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildTranslationValue(
  overrides: Partial<I18nTranslationValue> = {}
): I18nTranslationValue {
  return {
    key: 'marketing.hero.title',
    locale: 'fr',
    value: 'Le rituel ongles, en cinq minutes.',
    status: 'published',
    translatedBy: null,
    translatedAt: null,
    reviewed: true,
    reviewedBy: 'founder@femiglow.local',
    reviewedAt: new Date(),
    notes: null,
    confidence: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helpers pour tests E2E
export const SEED_LOCALES_FOR_TESTS = [
  buildLocale({ code: 'fr', isDefault: true, fallbackLocale: null }),
  buildLocale({
    code: 'ar',
    direction: 'rtl',
    fallbackLocale: 'fr',
    isDefault: false,
    displayNameNative: 'العربية',
    sortOrder: 20,
  }),
  buildLocale({
    code: 'en',
    fallbackLocale: 'fr',
    isDefault: false,
    enabled: false,
    displayNameNative: 'English',
    sortOrder: 30,
  }),
];
```

### 8.2 Usage en tests

```ts
import { describe, it, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { i18nLocales } from '@/lib/db/schema';
import { SEED_LOCALES_FOR_TESTS } from '@/test/factories/i18n.factory';

describe('i18n locale resolver', () => {
  beforeEach(async () => {
    await db.delete(i18nLocales);
    await db.insert(i18nLocales).values(SEED_LOCALES_FOR_TESTS);
  });

  it('résout la fallback chain ar → fr', async () => {
    const chain = await db.execute(sql`SELECT * FROM fn_i18n_resolve_chain('ar')`);
    expect(chain.rows).toEqual([
      { locale: 'ar', depth: 0 },
      { locale: 'fr', depth: 1 },
    ]);
  });
});
```

### 8.3 MSW handlers pour `/api/admin/i18n/*`

```ts
// apps/web/src/test/msw/handlers/i18n.ts
import { http, HttpResponse } from 'msw';
import { SEED_LOCALES_FOR_TESTS } from '@/test/factories/i18n.factory';

export const i18nHandlers = [
  http.get('/api/admin/i18n/locales', () => {
    return HttpResponse.json({ locales: SEED_LOCALES_FOR_TESTS });
  }),

  http.post('/api/admin/i18n/export', async ({ request }) => {
    const body = await request.json() as { locale: string; scope: string };
    return HttpResponse.json({
      downloadUrl: `/exports/i18n-${body.scope}-${body.locale}-${Date.now()}.csv`,
      keysCount: 600,
      generatedAt: new Date().toISOString(),
    });
  }),
];
```

## 9. Seed des `i18n_translation_keys` (V2 — optionnel V1)

Si on veut peupler la table de catalog en V1 (utile pour admin coverage) :

```ts
// apps/web/scripts/seed-i18n-keys-from-json.ts
import { readFileSync } from 'node:fs';
import { db } from '@/lib/db';
import { i18nTranslationKeys, i18nTranslationValues } from '@/lib/db/schema';

const messages = JSON.parse(
  readFileSync('apps/web/messages/fr.json', 'utf-8')
);

function flatten(
  obj: Record<string, unknown>,
  prefix: string[] = [],
): { key: string; value: string; namespace: string }[] {
  const result: { key: string; value: string; namespace: string }[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('_') || k === '$schema') continue;
    const path = [...prefix, k];
    if (typeof v === 'string') {
      result.push({
        key: path.join('.'),
        value: v,
        namespace: path[0],
      });
    } else if (v && typeof v === 'object') {
      result.push(...flatten(v as Record<string, unknown>, path));
    }
  }
  return result;
}

const entries = flatten(messages);

console.log(`Found ${entries.length} keys to seed`);

await db.transaction(async (tx) => {
  for (const e of entries) {
    await tx.insert(i18nTranslationKeys).values({
      key: e.key,
      namespace: e.namespace,
      type: 'static',
      sourceValue: e.value,
      priority: 'P1',                   // À ajuster manuellement
      extractionStatus: 'approved',
      isActive: true,
      addedBy: 'seed-script',
    }).onConflictDoNothing();

    await tx.insert(i18nTranslationValues).values({
      key: e.key,
      locale: 'fr',
      value: e.value,
      status: 'published',
      reviewed: true,
      reviewedBy: 'seed-script',
      reviewedAt: new Date(),
    }).onConflictDoNothing();
  }
});

console.log('Seed keys + FR values terminé');
```

## 10. Validation post-seed

### 10.1 SQL checks

```sql
-- Toutes les locales attendues sont présentes ?
SELECT code, display_name_native, enabled, is_default
  FROM i18n_locales
 ORDER BY sort_order;

-- Exactement 1 default ?
SELECT COUNT(*) FROM i18n_locales WHERE is_default = true;
-- Doit retourner 1

-- Pas de locale orpheline dans les tables existantes ?
SELECT COUNT(*) FROM component_field_bindings
 WHERE locale NOT IN (SELECT code FROM i18n_locales);
-- Doit retourner 0

-- Coverage initiale
SELECT * FROM v_i18n_coverage;
-- Doit montrer fr=100% (si keys seedées), ar=0%, en=0%
```

### 10.2 Tests automatisés

```bash
# Tests unit
pnpm test apps/web/src/lib/i18n/locales.test.ts

# Tests intégration
pnpm test:integration apps/web/src/lib/i18n/

# Smoke test après seed
pnpm test:smoke -- --grep "i18n locales"
```

## 11. Anti-patterns à éviter

1. **Skip --confirm en prod** : toujours dry-run d'abord, puis apply.
2. **Update sans audit** : si on change `is_default`, logger qui et pourquoi (table `audit_entries`).
3. **Hardcoder la liste des locales dans le code** : utiliser `getEnabledLocales()` qui query `i18n_locales WHERE enabled = true`.
4. **Mélanger seed et migration** : la migration crée le schema, le seed insère les données. Deux fichiers, deux responsabilités.
5. **Seed dépendant de l'ordre d'invocation** : utiliser `sort_order` et toujours trier ASC dans le code.
6. **Pas de check FK** : si on seed `ar` avec `fallback_locale='ru'` mais `ru` n'existe pas → FK violation. Toujours seeder le parent d'abord.
7. **Pas de transaction sur opérations multiples** : utiliser `db.transaction()` pour atomicité.
8. **Re-run en prod sans backup** : toujours `pg_dump` ou snapshot Neon avant.

## 12. Mise à jour ultérieure des locales

### 12.1 Ajouter une nouvelle locale (ex: `es` espagnol)

Process documenté dans `09-runbook/ajouter-nouvelle-langue.md`. Résumé :

```ts
// Dans LOCALES_SEED, ajouter :
{
  code: 'es',
  displayName: 'Spanish',
  displayNameNative: 'Español',
  direction: 'ltr',
  flagEmoji: '🇪🇸',
  fallbackLocale: 'fr',  // ou 'en' selon préférence
  // ...
  enabled: false,         // Initialement désactivé
  sortOrder: 40,
}
```

Puis re-run `pnpm seed:i18n` (idempotent → ajoute juste 'es').

### 12.2 Désactiver une locale temporairement

Pas dans le scope du seed. Utiliser admin UI ou SQL direct :

```sql
UPDATE i18n_locales SET enabled = false, updated_by = 'founder@femiglow.local'
 WHERE code = 'en';
```

### 12.3 Changer la fallback locale

Idem — admin UI ou SQL :

```sql
UPDATE i18n_locales SET fallback_locale = 'en' WHERE code = 'es';
```

Attention : doit auditer dans `audit_entries`.

## 13. Performance considérations

- **Seed du catalog** : pour 600-800 clés, transaction unique = ~5-10 secondes.
- **Backfill component_field_bindings** : ~ 50-100 lignes en prod = instantané.
- **Backfill legal_pages** : ~ 9 templates = instantané.
- **Pas de lock long** : les UPDATE sont rapides et n'impactent pas les requêtes en cours.

## 14. Référence — fichiers liés

- DDL : [`./translation-tables.sql`](./translation-tables.sql)
- Migration : `apps/web/drizzle/migrations/0076_i18n_locales.sql` (à créer)
- Script à créer : `apps/web/scripts/seed-i18n.ts`
- Test factories à créer : `apps/web/src/test/factories/i18n.factory.ts`
- Workflow translateur : [`./workflow-translation.md`](./workflow-translation.md)
- Migration FR hardcoded : [`./migration-historique.md`](./migration-historique.md)
- Extraction strings : [`./content-extraction.md`](./content-extraction.md)

## 15. Checklist seed

### Pré-seed
- [ ] Migration 0076 appliquée
- [ ] `DATABASE_URL` correctement définie
- [ ] Backup DB effectué (staging et prod)
- [ ] Liste de locales V1 confirmée par founder

### Seed
- [ ] `pnpm seed:i18n` en dev → 3 locales seedées
- [ ] Logs verbose vérifiés (pas d'erreur)
- [ ] `SELECT * FROM i18n_locales` retourne fr, ar, en
- [ ] `SELECT COUNT(*) FROM component_field_bindings WHERE locale IS NULL` retourne 0

### Post-seed
- [ ] View `v_i18n_coverage` accessible
- [ ] Function `fn_i18n_resolve_chain('ar')` retourne ar→fr
- [ ] Tests unit `i18n_locales` passent
- [ ] Smoke test `pnpm test:smoke:i18n` vert
- [ ] Documentation `09-runbook/ajouter-nouvelle-langue.md` à jour
- [ ] Audit log entry créée (qui a seedé, quand)
