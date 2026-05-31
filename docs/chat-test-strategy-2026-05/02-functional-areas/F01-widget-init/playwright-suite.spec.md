# F01 — Plan tests Playwright

## Suite — `e2e/visitor/chat-widget-init.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { ChatWidgetPOM } from '../pom/chat-widget.pom';
import { KitPagePOM } from '../pom/kit-page.pom';

test.describe('F01 — Widget initialization', () => {
  test.describe.configure({ mode: 'parallel' });

  test('@smoke @critical widget mounts on /kit within 1s', async ({ page }) => {
    const kit = new KitPagePOM(page);
    await kit.goto();

    const widget = new ChatWidgetPOM(page);
    await expect(widget.launcher()).toBeVisible({ timeout: 1000 });
  });

  test('@critical launcher click opens panel with focus on composer', async ({ page }) => {
    await page.goto('/kit');
    const widget = new ChatWidgetPOM(page);
    await widget.open();

    await expect(widget.panel()).toBeVisible();
    await expect(widget.composer()).toBeFocused();
  });

  test('@critical widget invisible when CHAT_ENABLED=false', async ({ page }) => {
    // Override toggle via API admin (auth admin)
    await page.request.put('/api/admin/chat/system/toggle', {
      data: { key: 'chat_enabled', value: false },
    });
    await page.goto('/kit');

    const widget = new ChatWidgetPOM(page);
    await expect(widget.launcher()).toHaveCount(0);

    // Cleanup
    await page.request.put('/api/admin/chat/system/toggle', {
      data: { key: 'chat_enabled', value: true },
    });
  });

  test('@perf LCP impact < 30ms vs page without widget', async ({ page }) => {
    // Mesure 1 : page sans widget (override flag)
    await page.request.put('/api/admin/chat/system/toggle', { data: { key: 'chat_enabled', value: false } });
    await page.goto('/kit', { waitUntil: 'load' });
    const lcpWithout = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length) resolve(entries[entries.length - 1].startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
    }) as number;

    // Mesure 2 : page avec widget
    await page.request.put('/api/admin/chat/system/toggle', { data: { key: 'chat_enabled', value: true } });
    await page.goto('/kit', { waitUntil: 'load' });
    const lcpWith = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length) resolve(entries[entries.length - 1].startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
    }) as number;

    const delta = lcpWith - lcpWithout;
    expect(delta).toBeLessThan(30);
  });

  test('@mobile launcher full-screen panel on iPhone 13', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium-mobile', 'Mobile only');

    await page.goto('/kit');
    const widget = new ChatWidgetPOM(page);
    await widget.open();

    const box = await widget.panel().boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(370); // viewport 390 minus margins
  });

  test('@multilang @critical launcher bottom-left for ar-MA', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium-rtl-ar', 'AR only');

    await page.goto('/kit');
    const widget = new ChatWidgetPOM(page);
    await expect(widget.launcher()).toBeVisible();

    const box = await widget.launcher().boundingBox();
    expect(box?.x).toBeLessThan(100); // bottom-LEFT
  });

  test('@a11y launcher passes axe', async ({ page }) => {
    const { default: AxeBuilder } = await import('@axe-core/playwright');
    await page.goto('/kit');
    await new ChatWidgetPOM(page).launcher().waitFor();

    const results = await new AxeBuilder({ page })
      .include('[data-chat-launcher]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious'))
      .toHaveLength(0);
  });

  test('@critical no remount on client-side navigation', async ({ page }) => {
    await page.goto('/kit');
    const widget = new ChatWidgetPOM(page);
    await widget.open();

    // Mark a state
    await widget.sendMessage('Hello');
    await widget.waitForAssistantReply();

    // Navigate client-side
    await page.click('a[href="/journal"]');
    await page.waitForURL('/journal');
    await page.click('a[href="/kit"]');
    await page.waitForURL('/kit');

    // Widget still open ? Or at least session preserved
    const stateAfterNav = await page.evaluate(() => (window as any).__chatStoreState?.());
    expect(stateAfterNav?.messages?.length).toBeGreaterThan(0);
  });
});
```

## Couverture summary

| Test ID | Tag | Couvre |
|---------|-----|--------|
| F01-E-01 | @smoke @critical | widget visible < 1 s |
| F01-E-02 | @critical | click → panel focus composer |
| F01-E-03 | @critical | flag OFF → no DOM |
| F01-E-04 | @perf | LCP impact < 30 ms |
| F01-E-05 | @mobile | mobile panel full-screen |
| F01-E-06 | @multilang @critical | RTL bottom-left |
| F01-E-07 | @a11y | axe pass |
| F01-E-08 | @critical | client-side nav preserves state |

## Setup recommandé

```typescript
test.beforeEach(async ({ page }) => {
  // Reset chat_enabled to true if previous test toggled
  await page.request.put('/api/admin/chat/system/toggle', {
    data: { key: 'chat_enabled', value: true },
  }).catch(() => {});
});
```
