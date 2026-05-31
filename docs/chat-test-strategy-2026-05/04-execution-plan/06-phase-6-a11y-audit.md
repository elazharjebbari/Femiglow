# Phase 6 — A11y audit complet + visual regression

**Durée** : 3-4 jours

## Jour 43 — Audit axe-playwright global

Pour chaque page admin (25 pages) + widget visiteur :

```typescript
// e2e/a11y/full-audit.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = [
  { url: '/kit', name: 'kit-with-widget' },
  { url: '/admin/chat', name: 'admin-overview' },
  { url: '/admin/chat/leads', name: 'admin-leads' },
  { url: '/admin/chat/conversations', name: 'admin-conversations' },
  // ... 25 pages
];

for (const { url, name } of PAGES) {
  test(`@a11y ${name} passes WCAG 2.1 AA`, async ({ page }) => {
    await page.goto(url);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    if (critical.length > 0) {
      console.error('A11y violations:', JSON.stringify(critical, null, 2));
    }
    expect(critical).toHaveLength(0);
  });
}
```

## Jour 44 — Tests screen reader (manuels)

Checklist par page (cf. [00-foundation/03-quality-gates.md](../00-foundation/03-quality-gates.md)) :

- [ ] VoiceOver Mac sur /kit + widget interaction
- [ ] NVDA Windows sur /admin/chat/leads (CRUD outcome)
- [ ] TalkBack Android sur /kit (mobile)
- [ ] iOS VoiceOver sur /kit

Documenter chaque pass dans le `a11y-report.md`.

## Jour 45 — Visual regression Playwright

Pour les pages critiques avec viewport stable :

```typescript
test('@visual chat panel default theme', async ({ page }) => {
  await page.goto('/kit');
  const widget = new ChatWidgetPOM(page);
  await widget.open();
  await expect(widget.panel()).toHaveScreenshot('panel-default-fr.png', {
    maxDiffPixels: 100,  // tolerance légère
  });
});

test('@visual chat panel dark mode RTL', async ({ page, context }) => {
  await context.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/kit?lang=ar-MA');
  await new ChatWidgetPOM(page).open();
  await expect(page.locator('[role="region"]')).toHaveScreenshot('panel-dark-rtl.png');
});
```

Snapshots stockés dans `e2e/__screenshots__/` (gitignore baseline images > 100 KB chacune).

## Jour 46 — Stabilisation visual snapshots

- Ignorer animations / curseurs blinking
- Stabiliser dates (frozen time)
- Bypass humanize jitter (toujours rendu instantané en test)
- Mocker contenu dynamique (date du jour, etc.)

**Gate sortie Phase 6** :
- A11y critique = 0 sur **25 pages admin + widget**
- A11y sérieux = 0 sur P0 pages
- Visual snapshots stables pour 10 cas clés
- Screen reader checklist signée pour P0 pages
