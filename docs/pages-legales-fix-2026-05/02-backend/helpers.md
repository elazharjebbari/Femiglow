# Helpers — code copiable

## 1. Feature flag

**Fichier nouveau** : `apps/web/src/lib/legal/feature-flag.ts`

```ts
/**
 * LEGAL-V2 — Feature flag pour le sprint pages légales.
 *
 * Active : nouveau naming vars + presetVarsForPage + UI create-var.
 * Par défaut false pour rollback-safe.
 *
 * Cf. docs/pages-legales-fix-2026-05/00-context/decisions-architecturales.md ADR-002.
 */
import { env } from '@/lib/env';

export function isLegalVarsV2Enabled(): boolean {
  return env.LEGAL_VARS_V2 === 'true';
}
```

**Édition** `apps/web/src/lib/env.ts` :

```diff
   CHAT_ADMIN_FILTERS_V2: z.enum(['true', 'false']).default('false'),
+  // LEGAL-V2 — Active nouveau naming vars + presets V2.
+  LEGAL_VARS_V2: z.enum(['true', 'false']).default('false'),
```

```diff
   CHAT_ADMIN_FILTERS_V2: process.env.CHAT_ADMIN_FILTERS_V2,
+  LEGAL_VARS_V2: process.env.LEGAL_VARS_V2,
```

## 2. `presetVarsForPage` — extension de `vars.ts`

**Fichier** : `apps/web/src/lib/legal/vars.ts`

**Diff** :

```diff
 export function presetVars(now: Date = new Date()): Map<string, string> {
   const m = new Map<string, string>();
   m.set('LAST_UPDATED', formatFrenchDate(now));
   m.set('CURRENT_YEAR', String(now.getFullYear()));
   m.set('SITE_URL', env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, ''));
   return m;
 }

 export function isPresetVar(key: string): boolean {
-  return key === 'LAST_UPDATED' || key === 'CURRENT_YEAR' || key === 'SITE_URL';
+  return (
+    key === 'LAST_UPDATED' ||
+    key === 'CURRENT_YEAR' ||
+    key === 'SITE_URL' ||
+    key === 'VERSION' // LEGAL-V2-01
+  );
 }
+
+/**
+ * LEGAL-V2 — Presets dérivés d'une page spécifique.
+ * Étend presetVars() avec VERSION et LAST_UPDATED contextuels (basés sur
+ * la page elle-même, pas le moment du render).
+ *
+ * Cf. docs/pages-legales-fix-2026-05/01-design-conception/api-contracts.md
+ */
+export function presetVarsForPage(
+  page: { version: number; updatedAt: Date },
+  now: Date = new Date(),
+): Map<string, string> {
+  const m = presetVars(now);
+  m.set('VERSION', `v${page.version}`);
+  m.set('LAST_UPDATED', formatFrenchDate(page.updatedAt));
+  return m;
+}
```

## 3. Cleanup logic

**Fichier nouveau** : `apps/web/src/lib/legal/cleanup.ts`

```ts
/**
 * LEGAL-V2 — Cleanup des pages test E2E orphelines.
 *
 * Supprime les rows legal_pages :
 *  - slug LIKE 'e2e-test-%'
 *  - status = 'draft'
 *  - created_at > N jours (default 7)
 *
 * Sécurité :
 *  - olderThanDays >= 7 (guard contre suppression de pages récentes)
 *  - DELETE hard (pages E2E n'ont pas de valeur historique)
 *  - À déclencher via endpoint admin authentifié
 *
 * Cf. docs/pages-legales-fix-2026-05/02-backend/api-routes.md
 */
import { and, eq, like, lt, sql } from 'drizzle-orm';

import { db, schema } from '@/lib/db/client';

export interface CleanupE2EInput {
  dryRun: boolean;
  olderThanDays: number;
}

export interface CleanupE2EResult {
  candidates: number;
  deleted: number;
  dryRun: boolean;
  criteria: {
    slugLike: string;
    status: string;
    olderThanDays: number;
  };
}

const SLUG_PATTERN = 'e2e-test-%';
const TARGET_STATUS = 'draft';

export async function cleanupLegalE2E(
  input: CleanupE2EInput,
): Promise<CleanupE2EResult> {
  if (input.olderThanDays < 7) {
    throw new Error('olderThanDays must be >= 7 (safety guard)');
  }
  const conn = db();
  if (!conn) throw new Error('cleanupLegalE2E requires DATABASE_URL');

  const cutoff = new Date(Date.now() - input.olderThanDays * 86_400_000);

  // 1. Compter
  const countRows = await conn
    .select({ value: sql<number>`COUNT(*)` })
    .from(schema.legalPages)
    .where(
      and(
        like(schema.legalPages.slug, SLUG_PATTERN),
        eq(schema.legalPages.status, TARGET_STATUS),
        lt(schema.legalPages.createdAt, cutoff),
      ),
    );
  const candidates = Number(countRows[0]?.value ?? 0);

  // 2. Supprimer (si pas dry-run)
  let deleted = 0;
  if (!input.dryRun && candidates > 0) {
    const result = await conn
      .delete(schema.legalPages)
      .where(
        and(
          like(schema.legalPages.slug, SLUG_PATTERN),
          eq(schema.legalPages.status, TARGET_STATUS),
          lt(schema.legalPages.createdAt, cutoff),
        ),
      )
      .returning({ id: schema.legalPages.id });
    deleted = result.length;
  }

  return {
    candidates,
    deleted,
    dryRun: input.dryRun,
    criteria: {
      slugLike: SLUG_PATTERN,
      status: TARGET_STATUS,
      olderThanDays: input.olderThanDays,
    },
  };
}
```

## 4. Helper pour suggestions vars manquantes

**Fichier nouveau** : `apps/web/src/lib/legal/template-vars-helpers.ts`

```ts
/**
 * LEGAL-V2 — Helpers pour la gestion des template vars.
 */
import { listAllTemplateVars, listLegalPages } from './repository';
import { detectVarsInTemplate, isPresetVar } from './vars';

/**
 * Retourne les vars utilisées dans les body_md mais non définies en DB
 * et non-preset. Utile pour suggérer à l'admin de créer ces vars.
 *
 * Cf. /admin/legal/template-vars page.
 */
export async function getUnusedTemplateVars(): Promise<string[]> {
  const pages = await listLegalPages({});
  const dbVars = await listAllTemplateVars();
  const dbKeys = new Set(dbVars.map((v) => v.key));

  const usedSet = new Set<string>();
  for (const page of pages) {
    for (const key of detectVarsInTemplate(page.bodyMd)) {
      if (!isPresetVar(key) && !dbKeys.has(key)) {
        usedSet.add(key);
      }
    }
  }
  return Array.from(usedSet).sort();
}

/**
 * Retourne les vars définies en DB mais jamais utilisées dans aucun body_md.
 * Candidates pour archivage / suppression.
 */
export async function getOrphanTemplateVars(): Promise<string[]> {
  const pages = await listLegalPages({});
  const dbVars = await listAllTemplateVars();

  const usedSet = new Set<string>();
  for (const page of pages) {
    for (const key of detectVarsInTemplate(page.bodyMd)) {
      usedSet.add(key);
    }
  }
  return dbVars
    .filter((v) => !usedSet.has(v.key))
    .map((v) => v.key)
    .sort();
}
```

## 5. Repository extension — create template var

**Fichier** : `apps/web/src/lib/legal/repository.ts`

**Ajouter** :

```ts
import { createId } from '@/lib/ids';
import { logger } from '@/lib/logging/logger';

export interface CreateTemplateVarInput {
  key: string;
  label: string;
  description?: string;
  value?: string;
  isRequired?: boolean;
  sortOrder?: number;
}

export async function createTemplateVar(
  input: CreateTemplateVarInput,
  actorId: string | null,
): Promise<{ ok: true; row: typeof schema.legalTemplateVars.$inferSelect } | { ok: false; code: 'conflict_key_exists' | 'invalid_key' }> {
  if (!/^[A-Z][A-Z0-9_]*$/.test(input.key)) {
    return { ok: false, code: 'invalid_key' };
  }
  const conn = db();
  if (!conn) throw new Error('createTemplateVar requires DATABASE_URL');

  // Check unique
  const existing = await conn
    .select()
    .from(schema.legalTemplateVars)
    .where(eq(schema.legalTemplateVars.key, input.key))
    .limit(1);
  if (existing[0]) {
    return { ok: false, code: 'conflict_key_exists' };
  }

  const rows = await conn
    .insert(schema.legalTemplateVars)
    .values({
      id: createId('ltv'),
      key: input.key,
      label: input.label,
      description: input.description ?? null,
      value: input.value ?? '',
      isRequired: input.isRequired ?? false,
      sortOrder: input.sortOrder ?? 100,
    })
    .returning();

  const row = rows[0]!;
  logger.info('legal.vars.create', {
    key: input.key,
    isRequired: row.isRequired,
    by: actorId,
  });
  return { ok: true, row };
}
```

## 6. Tests d'invariants (cross-table)

**Fichier nouveau** : `apps/web/src/lib/legal/__tests__/invariants.test.ts`

```ts
/**
 * LEGAL-V2 — Test d'invariant : toutes les vars utilisées dans templates
 * sont définies en DB OU sont presets.
 *
 * Échoue si un drift réapparaît dans le futur.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import { listAllTemplateVars, listLegalPages } from '../repository';
import { detectVarsInTemplate, isPresetVar } from '../vars';

describe('legal vars — invariant cross-table', () => {
  it('toutes les vars utilisées sont définies (DB ou preset)', async () => {
    const pages = await listLegalPages({});
    const dbVars = await listAllTemplateVars();
    const dbKeys = new Set(dbVars.map((v) => v.key));

    const violations: Array<{ slug: string; missing: string[] }> = [];

    for (const page of pages) {
      if (page.slug.startsWith('e2e-test-')) continue;
      const used = detectVarsInTemplate(page.bodyMd);
      const missing = used.filter(
        (key) => !isPresetVar(key) && !dbKeys.has(key),
      );
      if (missing.length > 0) {
        violations.push({ slug: page.slug, missing });
      }
    }

    if (violations.length > 0) {
      const detail = violations
        .map((v) => `  ${v.slug}: ${v.missing.join(', ')}`)
        .join('\n');
      throw new Error(
        `\nVars utilisées dans templates sans définition DB ni preset :\n${detail}\n`,
      );
    }

    expect(violations).toEqual([]);
  });
});
```

→ Si quelqu'un ajoute `{{NEW_VAR}}` à un template sans la définir en DB, ce test échoue.

## 7. Vérification post-implémentation

```bash
# 1. Type check
pnpm typecheck 2>&1 | grep "src/lib/legal/"

# 2. Tests unitaires des helpers
pnpm vitest run src/lib/legal/

# 3. Smoke local
LEGAL_VARS_V2=true pnpm tsx -e "
  const { presetVarsForPage } = await import('./src/lib/legal/vars');
  const m = presetVarsForPage({ version: 3, updatedAt: new Date() });
  console.log('VERSION =', m.get('VERSION'));
  console.log('LAST_UPDATED =', m.get('LAST_UPDATED'));
"
```
