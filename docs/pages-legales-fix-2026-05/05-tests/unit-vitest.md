# Tests unitaires Vitest

## 1. `vars.presetVarsForPage.test.ts` (nouveau)

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

import { presetVarsForPage, isPresetVar } from './vars';

describe('presetVarsForPage', () => {
  it('inclut VERSION dérivé de la page', () => {
    const m = presetVarsForPage({ version: 3, updatedAt: new Date('2026-05-27T00:00:00Z') });
    expect(m.get('VERSION')).toBe('v3');
  });

  it('inclut LAST_UPDATED basé sur updatedAt de la page', () => {
    const m = presetVarsForPage({ version: 1, updatedAt: new Date('2026-05-15T00:00:00Z') });
    expect(m.get('LAST_UPDATED')).toBe('15 mai 2026');
  });

  it('inclut aussi les presets globaux (SITE_URL, CURRENT_YEAR)', () => {
    const m = presetVarsForPage(
      { version: 1, updatedAt: new Date('2026-05-27T00:00:00Z') },
      new Date('2026-05-27T00:00:00Z'),
    );
    expect(m.get('SITE_URL')).toBe('https://femiglow.ma');
    expect(m.get('CURRENT_YEAR')).toBe('2026');
  });

  it('VERSION est reconnu comme preset', () => {
    expect(isPresetVar('VERSION')).toBe(true);
  });
});
```

## 2. `feature-flag.test.ts` (nouveau)

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('isLegalVarsV2Enabled', () => {
  const original = process.env.LEGAL_VARS_V2;

  beforeEach(() => { delete process.env.LEGAL_VARS_V2; vi.resetModules(); });
  afterEach(() => {
    if (original !== undefined) process.env.LEGAL_VARS_V2 = original;
    else delete process.env.LEGAL_VARS_V2;
    vi.resetModules();
  });

  it('renvoie false par défaut', async () => {
    process.env.LEGAL_VARS_V2 = 'false';
    const { isLegalVarsV2Enabled } = await import('./feature-flag');
    expect(isLegalVarsV2Enabled()).toBe(false);
  });

  it('renvoie true si LEGAL_VARS_V2=true', async () => {
    process.env.LEGAL_VARS_V2 = 'true';
    const { isLegalVarsV2Enabled } = await import('./feature-flag');
    expect(isLegalVarsV2Enabled()).toBe(true);
  });
});
```

## 3. `cleanup.test.ts` (nouveau)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockChain: any = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  delete: vi.fn(),
  returning: vi.fn(),
};

vi.mock('@/lib/db/client', () => ({
  db: () => ({
    select: () => mockChain,
    delete: () => mockChain,
  }),
  schema: { legalPages: {} },
}));

import { cleanupLegalE2E } from './cleanup';

describe('cleanupLegalE2E', () => {
  beforeEach(() => {
    Object.values(mockChain).forEach((fn: any) => fn.mockReset?.());
    mockChain.select.mockReturnValue(mockChain);
    mockChain.from.mockReturnValue(mockChain);
    mockChain.where.mockReturnValue(mockChain);
    mockChain.delete.mockReturnValue(mockChain);
  });

  it('rejette olderThanDays < 7', async () => {
    await expect(cleanupLegalE2E({ dryRun: true, olderThanDays: 3 })).rejects.toThrow(/safety guard/);
  });

  it('dryRun retourne candidates sans delete', async () => {
    mockChain.where.mockResolvedValueOnce([{ value: 5 }]);
    const result = await cleanupLegalE2E({ dryRun: true, olderThanDays: 7 });
    expect(result.candidates).toBe(5);
    expect(result.deleted).toBe(0);
    expect(result.dryRun).toBe(true);
  });

  it('utilise slug LIKE e2e-test-% et status draft', async () => {
    mockChain.where.mockResolvedValueOnce([{ value: 0 }]);
    const result = await cleanupLegalE2E({ dryRun: true, olderThanDays: 7 });
    expect(result.criteria.slugLike).toBe('e2e-test-%');
    expect(result.criteria.status).toBe('draft');
  });
});
```

## 4. `repository.createTemplateVar.test.ts` (nouveau)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockChain: any = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
};

vi.mock('@/lib/db/client', () => ({
  db: () => ({
    select: () => mockChain,
    insert: () => mockChain,
  }),
  schema: { legalTemplateVars: { key: 'key' } },
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { createTemplateVar } from './repository';

describe('createTemplateVar', () => {
  beforeEach(() => {
    Object.values(mockChain).forEach((fn: any) => fn.mockReset?.());
    Object.keys(mockChain).forEach((k) => { mockChain[k].mockReturnValue(mockChain); });
  });

  it('rejette key avec format invalide', async () => {
    const result = await createTemplateVar(
      { key: 'invalid-key', label: 'Label' },
      'admin@femiglow.local',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_key');
  });

  it('détecte conflict si key existe déjà', async () => {
    mockChain.limit.mockResolvedValueOnce([{ id: 'ltv_existing', key: 'EXISTING' }]);
    const result = await createTemplateVar(
      { key: 'EXISTING', label: 'Label' },
      'admin@femiglow.local',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('conflict_key_exists');
  });

  it('insert OK pour key valide unique', async () => {
    mockChain.limit.mockResolvedValueOnce([]);
    mockChain.returning.mockResolvedValueOnce([{
      id: 'ltv_new', key: 'NEW_VAR', label: 'New', isRequired: false,
    }]);
    const result = await createTemplateVar(
      { key: 'NEW_VAR', label: 'New' },
      'admin@femiglow.local',
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.key).toBe('NEW_VAR');
  });
});
```

## 5. `invariants.test.ts` (nouveau)

Cf. `02-backend/helpers.md` §6.

## 6. `template-vars-helpers.test.ts` (nouveau)

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('./repository', () => ({
  listAllTemplateVars: vi.fn(),
  listLegalPages: vi.fn(),
}));

vi.mock('./vars', async () => {
  const actual = await vi.importActual('./vars');
  return actual;
});

import { listAllTemplateVars, listLegalPages } from './repository';
import { getUnusedTemplateVars, getOrphanTemplateVars } from './template-vars-helpers';

describe('getUnusedTemplateVars', () => {
  it('retourne les vars utilisées dans templates mais sans définition DB', async () => {
    (listLegalPages as any).mockResolvedValue([
      { slug: 'cgu', bodyMd: 'Hello {{NEW_VAR}} world {{COMPANY_NAME}}' },
    ]);
    (listAllTemplateVars as any).mockResolvedValue([
      { key: 'COMPANY_NAME', value: 'X', isRequired: false },
    ]);
    const result = await getUnusedTemplateVars();
    expect(result).toEqual(['NEW_VAR']);
  });

  it('ignore les presets', async () => {
    (listLegalPages as any).mockResolvedValue([
      { slug: 'cgu', bodyMd: 'Updated {{LAST_UPDATED}} version {{VERSION}}' },
    ]);
    (listAllTemplateVars as any).mockResolvedValue([]);
    const result = await getUnusedTemplateVars();
    expect(result).toEqual([]);
  });
});

describe('getOrphanTemplateVars', () => {
  it('retourne les vars définies mais jamais utilisées', async () => {
    (listLegalPages as any).mockResolvedValue([
      { slug: 'cgu', bodyMd: '{{USED_VAR}}' },
    ]);
    (listAllTemplateVars as any).mockResolvedValue([
      { key: 'USED_VAR', value: '', isRequired: false },
      { key: 'ORPHAN_VAR', value: '', isRequired: false },
    ]);
    const result = await getOrphanTemplateVars();
    expect(result).toEqual(['ORPHAN_VAR']);
  });
});
```

## 7. Tests endpoint routes (cf. `02-backend/api-routes.md`)

- `template-vars/route.test.ts` (5 tests : 401, 400 key invalid, 409 conflict, 201 ok, 500)
- `cleanup-e2e/route.test.ts` (4 tests : 401, 400 days<7, 200 dryRun, 200 execute)

## Exécution

```bash
pnpm vitest run \
  src/lib/legal/vars.presetVarsForPage.test.ts \
  src/lib/legal/feature-flag.test.ts \
  src/lib/legal/cleanup.test.ts \
  src/lib/legal/repository.createTemplateVar.test.ts \
  src/lib/legal/__tests__/invariants.test.ts \
  src/lib/legal/template-vars-helpers.test.ts \
  src/app/api/admin/legal/template-vars/route.test.ts \
  src/app/api/admin/legal/cleanup-e2e/route.test.ts

# Attendu : 12+ tests passed
```
