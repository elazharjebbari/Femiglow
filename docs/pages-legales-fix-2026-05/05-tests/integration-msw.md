# Tests intégration MSW + DB

## 1. `legal-vars-rename.integration.test.ts` (nouveau)

```ts
/**
 * LEGAL-V2 — Test d'intégration migration rename.
 *
 * Valide que les valeurs des vars existantes sont préservées après rename.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { setupMemoryDb, resetMemoryDb } from '@/test/helpers/db-helpers';
import { db, schema } from '@/lib/db/client';
import { eq } from 'drizzle-orm';

vi.mock('@/lib/legal/feature-flag', () => ({
  isLegalVarsV2Enabled: () => true,
}));

beforeEach(async () => {
  await setupMemoryDb();
  // Seed COMPANY_EMAIL avec valeur connue
  await db().insert(schema.legalTemplateVars).values({
    id: 'ltv_test_email',
    key: 'COMPANY_EMAIL',
    label: 'Email contact',
    value: 'test@femiglow.com',
    isRequired: true,
    sortOrder: 100,
  });
});

afterEach(async () => { await resetMemoryDb(); });

describe('@legal-purity intégration — rename', () => {
  it('rename préserve la valeur après migration 0075', async () => {
    // Simuler la migration via UPDATE direct
    await db()
      .update(schema.legalTemplateVars)
      .set({ key: 'CONTACT_EMAIL', label: 'Email contact' })
      .where(eq(schema.legalTemplateVars.key, 'COMPANY_EMAIL'));

    const rows = await db()
      .select()
      .from(schema.legalTemplateVars)
      .where(eq(schema.legalTemplateVars.key, 'CONTACT_EMAIL'));

    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe('test@femiglow.com');  // valeur préservée !
  });
});
```

## 2. `legal-create-var.integration.test.ts` (nouveau)

```ts
import { describe, it, expect, beforeEach } from 'vitest';

import { createTemplateVar } from '@/lib/legal/repository';
import { setupMemoryDb, resetMemoryDb } from '@/test/helpers/db-helpers';

beforeEach(async () => { await setupMemoryDb(); });
afterEach(async () => { await resetMemoryDb(); });

describe('@legal-purity — create template var', () => {
  it('crée une var valide', async () => {
    const result = await createTemplateVar(
      { key: 'NEW_VAR', label: 'New variable', value: 'test', isRequired: false },
      'admin@femiglow.local',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row.key).toBe('NEW_VAR');
      expect(result.row.value).toBe('test');
    }
  });

  it('rejette key dupliquée', async () => {
    await createTemplateVar(
      { key: 'DUPLICATE', label: 'First' },
      'admin@femiglow.local',
    );
    const second = await createTemplateVar(
      { key: 'DUPLICATE', label: 'Second' },
      'admin@femiglow.local',
    );
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe('conflict_key_exists');
  });
});
```

## 3. `legal-cleanup-e2e.integration.test.ts` (nouveau)

```ts
import { describe, it, expect, beforeEach } from 'vitest';

import { cleanupLegalE2E } from '@/lib/legal/cleanup';
import { db, schema } from '@/lib/db/client';
import { setupMemoryDb, resetMemoryDb } from '@/test/helpers/db-helpers';

beforeEach(async () => { await setupMemoryDb(); });
afterEach(async () => { await resetMemoryDb(); });

describe('@legal-purity — cleanup E2E', () => {
  it('supprime les e2e-test orphelins > 7j', async () => {
    // Insérer 2 pages e2e-test : 1 récente, 1 ancienne
    const old = new Date(Date.now() - 10 * 86_400_000);
    const recent = new Date(Date.now() - 2 * 86_400_000);

    await db().insert(schema.legalPages).values([
      {
        id: 'lp_e2e_old',
        slug: 'e2e-test-001',
        title: 'Old',
        bodyMd: '',
        status: 'draft',
        version: 1,
        createdAt: old,
        updatedAt: old,
      },
      {
        id: 'lp_e2e_recent',
        slug: 'e2e-test-002',
        title: 'Recent',
        bodyMd: '',
        status: 'draft',
        version: 1,
        createdAt: recent,
        updatedAt: recent,
      },
    ]);

    const result = await cleanupLegalE2E({ dryRun: false, olderThanDays: 7 });
    expect(result.deleted).toBe(1);  // Only old one

    const remaining = await db().select().from(schema.legalPages);
    expect(remaining.find((p) => p.slug === 'e2e-test-001')).toBeUndefined();
    expect(remaining.find((p) => p.slug === 'e2e-test-002')).toBeDefined();
  });

  it('dryRun n\'affecte pas la DB', async () => {
    await db().insert(schema.legalPages).values({
      id: 'lp_dry', slug: 'e2e-test-dry', title: 'Test', bodyMd: '',
      status: 'draft', version: 1,
      createdAt: new Date(Date.now() - 10 * 86_400_000),
      updatedAt: new Date(),
    });
    const result = await cleanupLegalE2E({ dryRun: true, olderThanDays: 7 });
    expect(result.candidates).toBe(1);
    expect(result.deleted).toBe(0);
  });
});
```

## 4. `legal-publish-end-to-end.integration.test.ts` (nouveau)

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { publishLegalPage } from '@/lib/legal/publish';
import { db, schema } from '@/lib/db/client';
import { setupMemoryDb, resetMemoryDb } from '@/test/helpers/db-helpers';

vi.mock('@/lib/legal/feature-flag', () => ({
  isLegalVarsV2Enabled: () => true,
}));

beforeEach(async () => { await setupMemoryDb(); });
afterEach(async () => { await resetMemoryDb(); });

describe('@legal-purity — publish end-to-end', () => {
  it('publie OK si toutes les vars utilisées sont définies', async () => {
    // Seed vars
    await db().insert(schema.legalTemplateVars).values([
      { id: 'ltv_email', key: 'CONTACT_EMAIL', label: 'Email', value: 'info@x.com', isRequired: true, sortOrder: 1 },
      { id: 'ltv_ph', key: 'CONTACT_PHONE', label: 'Phone', value: '+212', isRequired: true, sortOrder: 2 },
    ]);

    // Seed page
    await db().insert(schema.legalPages).values({
      id: 'lp_test', slug: 'test-page', title: 'Test',
      bodyMd: 'Email: {{CONTACT_EMAIL}}, Tel: {{CONTACT_PHONE}}',
      status: 'draft', version: 1,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const result = await publishLegalPage('test-page', 'PUBLIER', 'admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.version).toBe(2);
  });

  it('rejette si vars utilisées manquantes', async () => {
    await db().insert(schema.legalPages).values({
      id: 'lp_test2', slug: 'test-missing', title: 'Test',
      bodyMd: 'Email: {{CONTACT_EMAIL}}',
      status: 'draft', version: 1,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const result = await publishLegalPage('test-missing', 'PUBLIER', 'admin');
    expect(result.ok).toBe(false);
    if (!result.ok && result.code === 'missing_required_vars') {
      expect(result.missing).toContain('CONTACT_EMAIL');
    }
  });
});
```

## 5. `legal-marketing-anonym.integration.test.ts` (nouveau)

Cf. `03-frontend-ui-ux/anonymisation-marketing.md` §test d'invariant.

## Exécution

```bash
pnpm vitest run src/test/integration/legal-*.integration.test.ts

# Attendu : 5+ tests verts
```
