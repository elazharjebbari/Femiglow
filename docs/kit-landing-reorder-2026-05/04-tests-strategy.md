# 04 — Stratégie de tests

## Pyramide

```
        ┌─────────┐
        │ axe a11y│   1 run CI sur /kit?layout=v2
        ├─────────┤
        │Lighthouse│   1 run CI mobile + desktop
        ├─────────┤
        │Playwright│   6 tests E2E @kit-layout-v2
        ├─────────┤
        │  MSW     │   mocks CMS unchanged (data identique v1/v2)
        ├─────────┤
        │ Vitest   │   3 tests flag + 1 snapshot ordre sections
        └─────────┘
```

## Vitest (unit)

### Tests flag
**Fichier** : `apps/web/src/lib/feature-flags/kit-layout.test.ts`

```ts
describe('KIT_LAYOUT_VERSION', () => {
  it('default v1 quand env absent', () => { ... });
  it('v2 quand env=true', () => { ... });
  it('v1 quand env=invalid (faux, 1, 0)', () => { ... });
});
```

### Snapshot ordre sections (optionnel)
**Fichier** : `apps/web/src/app/(marketing)/kit/page.snapshot.test.tsx`

Rend `KitPageV1` et `KitPageV2`, extrait l'ordre des `data-testid`, compare à un golden snapshot par version.

## Playwright (E2E)

### Tags
- `@kit-layout-v1` — non-régression
- `@kit-layout-v2` — nouvelle v2
- `@kit-sticky-cta` — cross-version

### Tests `@kit-layout-v2` (6 nouveaux)

```ts
test.describe('@kit-layout-v2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kit?layout=v2');
  });

  test('ordre des sections v2 desktop', async ({ page }) => {
    const sections = await page.locator('[data-section-id]').all();
    const ids = await Promise.all(sections.map(s => s.getAttribute('data-section-id')));
    expect(ids).toEqual([
      'hero-produit',
      'composition-reveal',
      'video-4-gestes',
      'product-feed',
      'hands-testimonials',
      'kit-commander',     // ← wizard pos 6
      'ingredients-details',
      'faq',
      'journal-grid',
    ]);
  });

  test('ordre des sections v2 mobile', async ({ page, isMobile }) => { ... });

  test('sticky CTA scroll-to-wizard', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.locator('[data-testid="kit-sticky-cta"]').click();
    await expect(page.locator('#commander-femiglow')).toBeInViewport();
  });

  test('tracking kit_section_viewed fire dans le bon ordre', async ({ page }) => { ... });

  test('absence sections retirées en v2', async ({ page }) => {
    await expect(page.locator('[data-testid="comparatif-section"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="rituals-module"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="pivot-final"]')).toHaveCount(0);
  });

  test('présence sections en v1 (non-régression)', async ({ page }) => {
    await page.goto('/kit?layout=v1');
    await expect(page.locator('[data-testid="comparatif-section"]')).toHaveCount(1);
  });
});
```

## MSW

Aucun nouveau mock. Le CMS (`getKitPageContent`, `getArticles`) retourne la **même data** en v1 et v2 — seul le layout change.

## Lighthouse

Script existant `apps/web-e2e/tests/lighthouse/` — étendre :

```ts
const URLS = [
  '/kit',                  // v1
  '/kit?layout=v2',        // v2
];
```

Cible mobile :
- Performance ≥ 85
- LCP < 2.5s
- CLS < 0.1
- TTI < 5s

**Hypothèse** : v2 doit être ≥ v1 (3 sections en moins = moins de JS bundle initial).

## axe (a11y)

Étendre `apps/web-e2e/tests/a11y/` :
- 0 violation `critical`
- 0 violation `serious`
- Vérifications spécifiques v2 :
  - Heading hierarchy intacte (pas de saut h2 → h4 après retraits)
  - Sticky CTA focus management
  - Landmark roles préservés

## CI gates

```yaml
# .github/workflows/kit-layout-v2.yml (conceptuel)
- run: pnpm --filter @femiglow/web test -- --run feature-flags kit-layout
- run: pnpm --filter @femiglow/web-e2e test -- --grep "@kit-layout"
- run: pnpm --filter @femiglow/web-e2e test:lighthouse -- /kit /kit?layout=v2
- run: pnpm --filter @femiglow/web-e2e test:a11y -- /kit /kit?layout=v2
```

Tous doivent passer **avant merge** sur master.
