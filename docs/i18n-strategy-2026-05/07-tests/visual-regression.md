# Visual regression — Playwright `toHaveScreenshot` par locale

> Tests de régression visuelle Playwright 1.48 pour FemiGlow i18n.
> Snapshots par locale (FR/AR/EN), audit RTL, mask des éléments dynamiques.

## 1. Pourquoi le visual regression i18n

Sans test visuel, un bug peut passer silencieusement :

- Un composant Tailwind `pl-4` au lieu de `ps-4` → casse en RTL, invisible en lecture de code
- Une police arabe trop large → text débordement, layout cassé
- Un `flex-row` non inversé → ordre des éléments cassé en AR
- Un `&::before` avec `right: 0` → en RTL, devrait être `inset-inline-end: 0`

Le visual diff par locale + viewport attrape ces régressions en un screenshot.

## 2. Stack

```ts
{
  "@playwright/test": "^1.48.0"
}
```

Pas de dépendance supplémentaire — `toHaveScreenshot()` est built-in.

## 3. Configuration Playwright pour visual

### 3.1 Config dédiée

```ts
// apps/web/playwright.config.ts (extrait visual)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/visual',
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      maxDiffPixelRatio: 0.001,
      threshold: 0.2,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
  },
  projects: [
    {
      name: 'visual-chromium-fr-desktop',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'fr-FR',
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'visual-chromium-ar-desktop',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ar-MA',
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'visual-chromium-en-desktop',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'en-US',
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'visual-chromium-fr-mobile',
      use: { ...devices['Pixel 5'], locale: 'fr-FR' },
    },
    {
      name: 'visual-chromium-ar-mobile',
      use: { ...devices['Pixel 5'], locale: 'ar-MA' },
    },
  ],
});
```

### 3.2 Snapshot path

```
apps/web/e2e/visual/
├── home.visual.spec.ts
├── kit.visual.spec.ts
├── maison.visual.spec.ts
├── checkout.visual.spec.ts
├── admin-dashboard.visual.spec.ts
├── locale-switcher.visual.spec.ts
└── __snapshots__/
    ├── home.visual.spec.ts/
    │   ├── home-desktop-fr-darwin-chromium.png
    │   ├── home-desktop-ar-darwin-chromium.png
    │   ├── home-desktop-en-darwin-chromium.png
    │   ├── home-mobile-fr-darwin-chromium.png
    │   └── home-mobile-ar-darwin-chromium.png
    └── ...
```

**Note critique** : les screenshots dépendent de l'OS (police rendering différent macOS vs Linux). En CI sur Linux, les baselines doivent être générées sur Linux. Pour éviter de générer 2 baselines, on **utilise une image Docker** pour générer baseline + run sur la même base.

## 4. Tests visuels par page

### 4.1 Home page snapshots

```ts
// apps/web/e2e/visual/home.visual.spec.ts
import { test, expect } from '@playwright/test';

const LOCALES = ['fr', 'ar', 'en'] as const;

for (const locale of LOCALES) {
  test.describe(`Home ${locale} @visual`, () => {
    test(`home ${locale} desktop snapshot`, async ({ page }) => {
      await page.goto(`/${locale}/`);

      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');

      const dynamicElements = [
        page.locator('[data-dynamic="timestamp"]'),
        page.locator('[data-dynamic="cart-count"]'),
        page.locator('[data-testid="cookie-banner"]'),
      ];

      await expect(page).toHaveScreenshot(`home-desktop-${locale}.png`, {
        fullPage: true,
        mask: dynamicElements,
        maxDiffPixels: 200,
      });
    });

    test(`home ${locale} hero only`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      await page.evaluate(() => document.fonts.ready);

      const hero = page.getByTestId('hero-section');
      await expect(hero).toHaveScreenshot(`hero-${locale}.png`, {
        maxDiffPixels: 100,
      });
    });
  });
}
```

### 4.2 Kit page

```ts
// apps/web/e2e/visual/kit.visual.spec.ts
import { test, expect } from '@playwright/test';

const LOCALES = ['fr', 'ar', 'en'] as const;

for (const locale of LOCALES) {
  test.describe(`Kit ${locale} @visual`, () => {
    test(`kit ${locale} full page`, async ({ page }) => {
      await page.goto(`/${locale}/kit`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot(`kit-${locale}.png`, {
        fullPage: true,
        mask: [
          page.locator('[data-testid="cookie-banner"]'),
          page.locator('[data-dynamic]'),
        ],
      });
    });

    test(`kit ${locale} product card`, async ({ page }) => {
      await page.goto(`/${locale}/kit`);
      const card = page.getByTestId('kit-product-card').first();
      await expect(card).toBeVisible();
      await expect(card).toHaveScreenshot(`kit-product-card-${locale}.png`);
    });

    test(`kit ${locale} mobile sticky CTA`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`/${locale}/kit`);
      const cta = page.getByTestId('kit-sticky-cta');
      await expect(cta).toBeVisible();
      await expect(cta).toHaveScreenshot(`kit-sticky-cta-${locale}-mobile.png`);
    });
  });
}
```

### 4.3 Checkout wizard

```ts
// apps/web/e2e/visual/checkout.visual.spec.ts
import { test, expect } from '@playwright/test';

const LOCALES = ['fr', 'ar', 'en'] as const;

for (const locale of LOCALES) {
  test.describe(`Checkout ${locale} @visual`, () => {
    test(`step 1 (shipping) ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/checkout`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot(`checkout-step1-${locale}.png`, {
        fullPage: false,
        mask: [
          page.locator('[data-dynamic="total"]'),
        ],
      });
    });

    test(`form errors ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/checkout`);
      await page.getByTestId('checkout-next-step').click();
      await page.waitForTimeout(300);

      const form = page.getByTestId('checkout-form');
      await expect(form).toHaveScreenshot(`checkout-errors-${locale}.png`);
    });
  });
}
```

### 4.4 Admin i18n dashboard

```ts
// apps/web/e2e/visual/admin-dashboard.visual.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Admin i18n dashboard @visual @admin', () => {
  test.use({ storageState: 'e2e/fixtures/admin-auth.json' });

  test('dashboard layout', async ({ page }) => {
    await page.goto('/admin/i18n/dashboard');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('admin-i18n-dashboard.png', {
      fullPage: true,
      mask: [
        page.locator('[data-dynamic]'),
        page.locator('[data-testid="last-updated"]'),
      ],
    });
  });

  test('coverage gauge component', async ({ page }) => {
    await page.goto('/admin/i18n/dashboard');
    const gauge = page.getByTestId('coverage-gauge-ar');
    await expect(gauge).toHaveScreenshot('coverage-gauge-ar.png');
  });
});
```

### 4.5 LocaleSwitcher dropdown

```ts
// apps/web/e2e/visual/locale-switcher.visual.spec.ts
import { test, expect } from '@playwright/test';

const LOCALES = ['fr', 'ar', 'en'] as const;

for (const locale of LOCALES) {
  test.describe(`LocaleSwitcher ${locale} @visual`, () => {
    test(`closed state ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      const switcher = page.getByTestId('locale-switcher-button');
      await expect(switcher).toHaveScreenshot(`switcher-closed-${locale}.png`);
    });

    test(`open dropdown ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      await page.getByTestId('locale-switcher-button').click();

      const menu = page.getByTestId('locale-switcher-menu');
      await expect(menu).toBeVisible();
      await expect(menu).toHaveScreenshot(`switcher-open-${locale}.png`);
    });

    test(`switcher hover state ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      await page.getByTestId('locale-switcher-button').hover();
      const switcher = page.getByTestId('locale-switcher-button');
      await expect(switcher).toHaveScreenshot(`switcher-hover-${locale}.png`);
    });
  });
}
```

## 5. Audit RTL FR vs AR side-by-side

### 5.1 Comparaison visuelle programmatique

```ts
// apps/web/e2e/visual/rtl-audit.visual.spec.ts
import { test, expect } from '@playwright/test';
import sharp from 'sharp';

test.describe('RTL audit FR vs AR @visual', () => {
  test('hero FR is mirror of AR', async ({ page }) => {
    await page.goto('/fr/');
    const frHero = await page.getByTestId('hero-section').screenshot();

    await page.goto('/ar/');
    const arHero = await page.getByTestId('hero-section').screenshot();

    const frMirrored = await sharp(frHero).flop().toBuffer();
    const arMeta = await sharp(arHero).metadata();
    const frMeta = await sharp(frMirrored).metadata();

    expect(arMeta.width).toBe(frMeta.width);
    expect(arMeta.height).toBe(frMeta.height);
  });

  test('navigation order is inverted', async ({ page }) => {
    await page.goto('/fr/');
    const frNav = page.getByRole('navigation');
    const frLinks = await frNav.locator('a').all();
    const frPositions: number[] = [];
    for (const link of frLinks) {
      const box = await link.boundingBox();
      if (box) frPositions.push(box.x);
    }

    await page.goto('/ar/');
    const arNav = page.getByRole('navigation');
    const arLinks = await arNav.locator('a').all();
    const arPositions: number[] = [];
    for (const link of arLinks) {
      const box = await link.boundingBox();
      if (box) arPositions.push(box.x);
    }

    expect(arPositions).toEqual([...frPositions].reverse().map((_, i) => arPositions[i]));
  });
});
```

## 6. Mask des éléments dynamiques

Les éléments suivants doivent être masqués pour éviter les faux positifs :

| Élément | Raison | data-testid / data-* |
|---|---|---|
| Cookie banner | Toujours présent au 1er load | `[data-testid="cookie-banner"]` |
| Date/timestamp affiché | Change chaque seconde | `[data-dynamic="timestamp"]` |
| Compteur panier | Dépend du state | `[data-dynamic="cart-count"]` |
| Total dynamique checkout | Change selon items | `[data-dynamic="total"]` |
| Photos produits CDN | Possible cache miss → tailles différentes | `[data-dynamic="product-image"]` |
| Animations CSS | Non déterministes | `animations: 'disabled'` config |
| Vidéo background | Frame change | `[data-dynamic="bg-video"]` |
| Carousel auto-rotate | Position aléatoire | `[data-dynamic="carousel"]` |

### 6.1 Convention de marquage des éléments dynamiques

Dans le code TSX :

```tsx
// Pour les éléments dynamiques par nature
<time data-dynamic="timestamp">
  {formatRelativeTime(date, locale)}
</time>

// Pour le banner cookies
<div data-testid="cookie-banner" data-dynamic="banner">
  ...
</div>
```

Dans le test :

```ts
await expect(page).toHaveScreenshot('page.png', {
  mask: [
    page.locator('[data-dynamic]'),
    page.locator('[data-testid="cookie-banner"]'),
  ],
  // mask color: gris par défaut, peut customiser :
  maskColor: '#000000',
});
```

## 7. Threshold et tolérance

### 7.1 Configuration par défaut

```ts
expect: {
  toHaveScreenshot: {
    maxDiffPixels: 100,       // 100 px de diff max
    maxDiffPixelRatio: 0.001, // ou 0.1% de la surface
    threshold: 0.2,           // tolérance couleur par pixel
    animations: 'disabled',
    caret: 'hide',
  },
}
```

### 7.2 Override par test

```ts
await expect(page).toHaveScreenshot('hero.png', {
  maxDiffPixels: 50,        // strict pour le hero
  threshold: 0.1,           // strict couleur
});

// Si on accepte des variations plus larges (e.g. mobile)
await expect(page).toHaveScreenshot('mobile-fold.png', {
  maxDiffPixels: 500,
  threshold: 0.3,
});
```

### 7.3 Tolérance recommandée par type

| Type | maxDiffPixels | threshold | Justification |
|---|---|---|---|
| Hero (above the fold) | 100 | 0.2 | Critique, strict |
| Section secondaire | 300 | 0.25 | Tolérance modérée |
| Mobile sticky CTA | 50 | 0.15 | Petit composant, strict |
| Full page snapshot | 1000 | 0.2 | Cumul des variations |
| Composant isolé | 30 | 0.1 | Très strict |

## 8. Génération de baseline

### 8.1 Première génération

```bash
# Lancer Docker pour générer baselines Linux (consistant avec CI)
docker run --rm -v $(pwd):/app -w /app \
  mcr.microsoft.com/playwright:v1.48.0-jammy \
  pnpm exec playwright test --update-snapshots e2e/visual
```

### 8.2 Mise à jour ciblée

```bash
# Une fois lance, voir le diff
pnpm exec playwright test --reporter=html e2e/visual/home.visual.spec.ts

# Si diff acceptable (e.g. changement UI volontaire) :
pnpm exec playwright test --update-snapshots e2e/visual/home.visual.spec.ts
```

### 8.3 Review code pour baselines

Toute baseline mise à jour doit être reviewée dans la PR :

- Le reviewer télécharge l'archive `playwright-report`
- Inspecte les 3 PNG (FR/AR/EN) pour la page modifiée
- Approuve ou demande révision si le change visuel n'est pas voulu

Convention de commit pour update :

```
test(visual): update home baseline post hero redesign
```

## 9. CI workflow

### 9.1 Stratégie Docker pour consistance

```yaml
# .github/workflows/visual-regression.yml
name: visual regression
on:
  pull_request:
    paths:
      - 'apps/web/src/**'
      - 'apps/web/messages/**'

jobs:
  visual:
    name: Visual regression
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.48.0-jammy
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm --filter @femiglow/web build
      - run: pnpm --filter @femiglow/web start &
      - run: |
          until curl -s http://localhost:3000 > /dev/null; do sleep 2; done
      - run: pnpm --filter @femiglow/web test:visual
      - name: Upload diff report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-visual-report
          path: apps/web/playwright-report
          retention-days: 30
```

### 9.2 Update baselines workflow (manual trigger)

```yaml
# .github/workflows/update-visual-baselines.yml
name: Update visual baselines
on:
  workflow_dispatch:
    inputs:
      target_branch:
        required: true
        type: string

jobs:
  update:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.48.0-jammy
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.target_branch }}
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm --filter @femiglow/web build
      - run: pnpm --filter @femiglow/web start &
      - run: pnpm --filter @femiglow/web test:visual --update-snapshots
      - uses: peter-evans/create-pull-request@v6
        with:
          commit-message: 'test(visual): update baselines'
          branch: visual-baselines-update
```

## 10. Anti-patterns

1. **Pas de mask** des éléments dynamiques → flaky.
2. **Génération baseline locale macOS** → diff CI Linux assuré.
3. **`fullPage: true` sans scroll lazy load attendu** → image vide en bas.
4. **`threshold: 0`** → vraiment 0 pixel diff = impossible.
5. **Snapshot par locale × viewport × theme** sans limite → 50 PNG par page.
6. **Pas waitFor fonts ready** → polices fallback rendues = diff faux.
7. **Pas wait `networkidle`** → image en cours de load.
8. **Animations enabled** → frame différente à chaque run.
9. **Caret visible dans input focus** → clignote, diff aléatoire.
10. **Pas commit le screenshot** : git LFS ou commit binary, sinon CI fail.

## 11. Storage des screenshots

### 11.1 Git LFS

```bash
# .gitattributes
e2e/visual/__snapshots__/**/*.png filter=lfs diff=lfs merge=lfs -text
```

Ainsi le repo reste léger, les PNG sont en LFS.

### 11.2 Alternative : artifact storage

Si Git LFS pas voulu, stocker les baselines en S3 :

```bash
# scripts/sync-visual-baselines.mjs
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
// ... télécharger depuis S3 au début du job
```

## 12. Métriques

À tracker pour décider de la santé du visual regression :

| Métrique | Cible | Action si dépassée |
|---|---|---|
| Nombre de baselines | < 100 | Refactor : moins de snapshots, plus de composants |
| Taille totale dossier `__snapshots__` | < 50 MB | Compression, LFS |
| Runtime CI visual | < 5 min | Parallélisation, viewport count down |
| Faux positifs / mois | < 2 | Améliorer mask, ajuster threshold |

## 13. Documentation visuelle générée

```bash
# Génère un HTML avec toutes les baselines côte à côte
pnpm --filter @femiglow/web exec playwright show-report

# Ou un script custom
node scripts/generate-visual-doc.mjs
# → docs/i18n-strategy-2026-05/07-tests/visual-baselines.html
```

## 14. Commandes

```bash
# Run tous les visual
pnpm --filter @femiglow/web test:visual

# Un projet
pnpm --filter @femiglow/web exec playwright test --project=visual-chromium-ar-desktop e2e/visual

# Update baselines
pnpm --filter @femiglow/web exec playwright test --update-snapshots e2e/visual

# Voir le diff
pnpm --filter @femiglow/web exec playwright show-report
```

## 15. Checklist visual regression

- [ ] Baseline générée sur Linux (Docker image Playwright)
- [ ] Mask appliqué sur tous les `data-dynamic`
- [ ] `await page.evaluate(() => document.fonts.ready)` avant snapshot
- [ ] `await page.waitForLoadState('networkidle')` avant snapshot
- [ ] `animations: 'disabled'` dans config
- [ ] 3 locales × 2 viewports × N pages snapshots (raisonnable)
- [ ] `fullPage: true` uniquement si vraiment nécessaire (lent + lourd)
- [ ] PNG commit sur Git LFS
- [ ] CI fail si diff > threshold
- [ ] Workflow manual update baselines disponible
- [ ] PR review baselines visible dans HTML report
- [ ] Pas de snapshot dépendant du temps (`now`, `today`)
