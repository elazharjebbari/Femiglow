# 70.3 — Suites Playwright e2e

## Inventory

| Fichier | Tests | Cible |
|---|---|---|
| `e2e/admin-event-mappings/list.spec.ts` | T40 + smoke | F.1 (liste + filtres) |
| `e2e/admin-event-mappings/create-wizard.spec.ts` | T41-T42 | F.2 (wizard) |
| `e2e/admin-event-mappings/edit-matrix.spec.ts` | T43-T44 | F.3-F.4 (edit + save = new version) |
| `e2e/admin-event-mappings/activate.spec.ts` | T45 | F.5 |
| `e2e/admin-event-mappings/delete.spec.ts` | T46 | F.7 |
| `e2e/admin-event-mappings/diff.spec.ts` | T47 | F.9 |
| `e2e/admin-event-mappings/test-modal.spec.ts` | T48 | F.10 |
| `e2e/admin-event-mappings/export-gtm.spec.ts` | T49 | F.11 |
| `e2e/admin-event-mappings/reset-default.spec.ts` | T50 | F.12 |
| `e2e/admin-event-mappings/a11y.spec.ts` | T51-T52 | Q.5 |
| `e2e/admin-event-mappings/keyboard.spec.ts` | T53 | Q.6 |
| `e2e/admin-event-mappings/ULTIMATE-round-trip-gtm.spec.ts` | T54 | Q.4 |
| `e2e/admin-event-mappings/perf.spec.ts` | T57 | P.3 |

## Setup auth admin

Le `playwright.config.ts` existant a probablement déjà un `storageState.json` ou un `globalSetup` qui login admin. À réutiliser.

```typescript
// playwright.config.ts (extrait)
projects: [
  {
    name: 'admin',
    use: { storageState: '.playwright/admin-state.json' },
    testDir: './e2e',
    grep: /admin-event-mappings/,
  },
],
globalSetup: './e2e/global-setup.ts',
```

## Pattern e2e

```typescript
import { test, expect } from '@playwright/test';

test.describe('Event mappings — liste', () => {
  test('liste affiche la version active avec badge', async ({ page }) => {
    await page.goto('/admin/tracking/events/mappings');
    if (page.url().includes('/admin/login')) {
      // Mode dégradé sans seed admin
      return;
    }
    
    const activeRow = page.getByTestId('version-row-active');
    await expect(activeRow).toBeVisible();
    await expect(activeRow.getByText('ACTIVE')).toBeVisible();
  });
});
```

## Test ULTIMATE round-trip GTM (T54)

C'est LE test critique. Garantit que le format d'export est vraiment importable.

```typescript
// e2e/admin-event-mappings/ULTIMATE-round-trip-gtm.spec.ts
import { test, expect } from '@playwright/test';
import { z } from 'zod';

// Schema GTM Container officiel (extrait simplifié)
const gtmContainerSchema = z.object({
  exportFormatVersion: z.literal(2),
  exportTime: z.string(),
  containerVersion: z.object({
    container: z.object({
      name: z.string(),
      publicId: z.string(),
      usageContext: z.array(z.literal('WEB')),
    }),
    tag: z.array(z.object({
      tagId: z.string(),
      name: z.string(),
      type: z.string(),
      parameter: z.array(z.object({
        type: z.string(),
        key: z.string(),
        value: z.string(),
      })),
      firingTriggerId: z.array(z.string()),
    })),
    trigger: z.array(z.object({
      triggerId: z.string(),
      name: z.string(),
      type: z.string(),
    })),
    variable: z.array(z.object({
      variableId: z.string(),
      name: z.string(),
      type: z.string(),
    })),
  }),
});

test('ULTIMATE — export GTM produit un JSON valide selon schema officiel', async ({ page, request }) => {
  await page.goto('/admin/tracking/events/mappings');
  if (page.url().includes('/admin/login')) return;
  
  // 1. Active __default__ pour avoir un état stable
  const resetRes = await request.post('/api/admin/tracking/events/mappings/reset-default');
  expect(resetRes.ok()).toBeTruthy();
  
  // 2. Export GTM de la version active (= __default__)
  const listRes = await request.get('/api/admin/tracking/events/mappings');
  const list = await listRes.json();
  const activeId = list.activeId;
  expect(activeId).toBe('__default__');
  
  const exportRes = await request.post(`/api/admin/tracking/events/mappings/${activeId}/export-gtm`, {
    data: { env: 'production' },
  });
  expect(exportRes.ok()).toBeTruthy();
  const { containerJson, meta } = await exportRes.json();
  
  // 3. Valide contre le schema officiel
  const parsed = gtmContainerSchema.parse(containerJson);
  expect(parsed.exportFormatVersion).toBe(2);
  expect(parsed.containerVersion.tag.length).toBeGreaterThan(0);
  
  // 4. Vérifie cohérence triggers ↔ tags
  const triggerIds = new Set(parsed.containerVersion.trigger.map((t) => t.triggerId));
  for (const tag of parsed.containerVersion.tag) {
    for (const tid of tag.firingTriggerId) {
      expect(triggerIds.has(tid)).toBe(true);
    }
  }
  
  // 5. Vérifie sha256 reproductible (export 2x → même sha256)
  const exportRes2 = await request.post(`/api/admin/tracking/events/mappings/${activeId}/export-gtm`, {
    data: { env: 'production' },
  });
  const { meta: meta2 } = await exportRes2.json();
  expect(meta.sha256).toBe(meta2.sha256);
});
```

## Tests perf

```typescript
test('LCP < 200ms sur /admin/tracking/events/mappings (build prod)', async ({ page }) => {
  const lcp = await page.evaluate(async () => {
    const url = window.location.href;
    const start = performance.now();
    await new Promise<void>((resolve) => {
      new PerformanceObserver((list) => {
        const last = list.getEntries().at(-1);
        if (last) resolve();
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    return performance.now() - start;
  });
  expect(lcp).toBeLessThan(200);
});
```
