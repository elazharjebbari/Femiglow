# 70.2 — Suites Vitest

Toutes les suites unit + integration en Vitest. Fichiers `*.test.ts` colocated avec le code testé OU dans `src/test/integration/`.

## Inventory

| Fichier | Type | Tests |
|---|---|---|
| `lib/tracking/mappings/store.test.ts` | unit | T01-T10 (~25 tests CRUD/transitions/FIFO) |
| `lib/tracking/mappings/resolver.test.ts` | unit | T11-T14, T56 (~12 tests cache/fallback/perf) |
| `lib/tracking/mappings/validator.test.ts` | unit | T15-T18 (~15 tests Zod par provider) |
| `lib/tracking/mappings/gtm-export.test.ts` | unit | T19-T23, T58 (~12 tests build/sha256/round-trip) |
| `lib/tracking/mappings/audit.test.ts` | unit | (~8 tests insert/list) |
| `lib/tracking/mappings/seed.test.ts` | unit | T55 (~5 tests idempotence) |
| `test/integration/admin-mappings-list.test.ts` | integration | T24-T25 |
| `test/integration/admin-mappings-create.test.ts` | integration | T26-T30 |
| `test/integration/admin-mappings-update.test.ts` | integration | T31-T32 |
| `test/integration/admin-mappings-delete.test.ts` | integration | T33-T34 |
| `test/integration/admin-mappings-activate.test.ts` | integration | T35 |
| `test/integration/admin-mappings-test-dispatch.test.ts` | integration | T36 |
| `test/integration/admin-mappings-export-gtm.test.ts` | integration | T37, T59 |
| `test/integration/admin-mappings-reset.test.ts` | integration | T38 |
| `test/integration/admin-mappings-diff.test.ts` | integration | T39 |
| `scripts/check-default-mapping.test.ts` | unit | T60 (CI safeguard) |
| `components/admin/tracking/mappings/MappingMatrix.test.tsx` | unit (RTL) | ~12 tests (render, click, edit, a11y) |
| `components/admin/tracking/mappings/MappingDiffViewer.test.tsx` | unit (RTL) | ~8 tests |
| `components/admin/tracking/mappings/MappingCreateWizard.test.tsx` | unit (RTL) | ~10 tests (steps, validation) |
| `components/admin/tracking/mappings/__a11y__.test.tsx` | unit (axe) | ~5 tests axe-core |

## Pattern global

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSession } from '@/lib/auth/session';

let sessionMock: AdminSession | null = {
  adminId: 'adm_test',
  email: 'admin@femiglow.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3600_000,
};

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
  requireAdmin: () => Promise.resolve(sessionMock),
}));

const { auditMock } = vi.hoisted(() => ({ auditMock: vi.fn() }));
vi.mock('@/lib/tracking/server/audit', () => ({ auditTrackingChange: auditMock }));

beforeEach(async () => {
  sessionMock = { adminId: 'adm_test', email: 'admin@femiglow.ma', issuedAt: Date.now(), expiresAt: Date.now() + 3600_000 };
  await mappingStore._resetForTests({ actorId: 'adm_test' });
  auditMock.mockClear();
});

describe('xxx', () => {
  // ...
});
```

## Coverage targets

| Module | Target coverage |
|---|---|
| `lib/tracking/mappings/store.ts` | > 90% |
| `lib/tracking/mappings/resolver.ts` | > 95% |
| `lib/tracking/mappings/validator.ts` | > 95% |
| `lib/tracking/mappings/gtm-export.ts` | > 85% |
| `lib/tracking/mappings/audit.ts` | > 90% |
| `app/api/admin/tracking/events/mappings/**/*.ts` | > 80% |
| **Global module** | **> 85%** |

## CI safeguards

- `pnpm tracking:check-default-mapping` doit passer (CI fail si drift)
- `pnpm test --coverage --threshold lines=85 --include='src/lib/tracking/mappings/**'` enforced sur PR
- Test ULTIMATE round-trip GTM (T54) doit passer

## Fixtures partagées

`test/fixtures/mappings.ts` :
```typescript
export const FIXTURE_MAPPINGS_MIN = {
  purchase: {
    meta:       { mappedName: 'Purchase', isCustom: false, isEnabled: true },
    google_ga4: { mappedName: 'purchase', isCustom: false, isEnabled: true },
    google_ads: { mappedName: 'purchase', isCustom: false, isEnabled: true },
    tiktok:     { mappedName: 'CompletePayment', isCustom: false, isEnabled: true },
    snap:       { mappedName: 'PURCHASE', isCustom: false, isEnabled: true },
    pinterest:  { mappedName: 'checkout', isCustom: false, isEnabled: true },
  },
};

export const FIXTURE_VERSION_ACTIVE = {
  id: 'emv_test_active',
  name: 'Test active',
  status: 'active',
  isActive: true,
  isDefault: false,
  mappings: FIXTURE_MAPPINGS_MIN,
  // ...
};
```
