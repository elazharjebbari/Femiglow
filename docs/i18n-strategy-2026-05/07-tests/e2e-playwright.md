# E2E tests — Playwright multi-locale FemiGlow

> Tests end-to-end Playwright 1.48 pour le flow i18n complet : switcher, RTL, wizard checkout, cookie persistence, hreflang, 404 localisée.
> Code complet `.spec.ts`, data-testid selectors, fixtures Playwright.

## 1. Setup Playwright pour i18n

### 1.1 Config `playwright.config.ts`

```ts
// apps/web/playwright.config.ts (extrait i18n)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ...(process.env.CI ? [['github']] : []),
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium-fr',
      use: { ...devices['Desktop Chrome'], locale: 'fr-FR' },
      testMatch: /.*\.(fr|all)\.spec\.ts/,
    },
    {
      name: 'chromium-ar',
      use: { ...devices['Desktop Chrome'], locale: 'ar-MA' },
      testMatch: /.*\.(ar|all)\.spec\.ts/,
    },
    {
      name: 'chromium-en',
      use: { ...devices['Desktop Chrome'], locale: 'en-US' },
      testMatch: /.*\.(en|all)\.spec\.ts/,
    },
    {
      name: 'mobile-fr',
      use: { ...devices['Pixel 5'], locale: 'fr-FR' },
      testMatch: /.*\.mobile\.(fr|all)\.spec\.ts/,
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### 1.2 Custom fixtures `e2e/fixtures/i18n.ts`

```ts
// apps/web/e2e/fixtures/i18n.ts
import { test as base, expect } from '@playwright/test';

type Locale = 'fr' | 'ar' | 'en';

interface I18nFixtures {
  setLocale: (locale: Locale) => Promise<void>;
  gotoLocalized: (path: string) => Promise<void>;
  expectLocaleAttrs: (locale: Locale) => Promise<void>;
  expectHreflang: (page: { path: string; locale: Locale }[]) => Promise<void>;
}

export const test = base.extend<I18nFixtures>({
  setLocale: async ({ context }, use) => {
    await use(async (locale: Locale) => {
      await context.addCookies([
        {
          name: 'NEXT_LOCALE',
          value: locale,
          domain: 'localhost',
          path: '/',
          maxAge: 60 * 60 * 24 * 365,
        },
      ]);
    });
  },

  gotoLocalized: async ({ page, baseURL }, use) => {
    await use(async (path: string) => {
      const url = new URL(path, baseURL);
      await page.goto(url.toString());
    });
  },

  expectLocaleAttrs: async ({ page }, use) => {
    await use(async (locale: Locale) => {
      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', locale);
      const dir = locale === 'ar' ? 'rtl' : 'ltr';
      await expect(html).toHaveAttribute('dir', dir);
    });
  },

  expectHreflang: async ({ page }, use) => {
    await use(async (expected: { path: string; locale: Locale }[]) => {
      for (const { path, locale } of expected) {
        const link = page.locator(`link[rel="alternate"][hreflang="${locale}"]`);
        await expect(link).toHaveAttribute('href', new RegExp(path));
      }
    });
  },
});

export { expect };
```

## 2. Test : path detection + locale switching

### 2.1 `e2e/i18n/switcher.all.spec.ts`

```ts
// apps/web/e2e/i18n/switcher.all.spec.ts
import { test, expect } from '../fixtures/i18n';

test.describe('Locale switcher @critical', () => {
  test('switches from /fr/kit to /ar/kit and preserves path', async ({ page }) => {
    await page.goto('/fr/kit');
    await expect(page).toHaveURL(/\/fr\/kit/);

    const switcher = page.getByTestId('locale-switcher-button');
    await switcher.click();

    const arItem = page.getByTestId('locale-switcher-item-ar');
    await arItem.click();

    await expect(page).toHaveURL(/\/ar\/kit/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('switches /fr/maison/produit-x → /en/maison/produit-x', async ({ page }) => {
    await page.goto('/fr/maison/produit-x');

    await page.getByTestId('locale-switcher-button').click();
    await page.getByTestId('locale-switcher-item-en').click();

    await expect(page).toHaveURL(/\/en\/maison\/produit-x/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('keeps query string on locale switch', async ({ page }) => {
    await page.goto('/fr/kit?utm_source=newsletter');

    await page.getByTestId('locale-switcher-button').click();
    await page.getByTestId('locale-switcher-item-ar').click();

    await expect(page).toHaveURL(/\/ar\/kit\?utm_source=newsletter/);
  });

  test('dropdown closes after locale selection', async ({ page }) => {
    await page.goto('/fr/kit');
    await page.getByTestId('locale-switcher-button').click();
    await expect(page.getByTestId('locale-switcher-menu')).toBeVisible();

    await page.getByTestId('locale-switcher-item-en').click();

    await expect(page.getByTestId('locale-switcher-menu')).not.toBeVisible();
  });

  test('active locale has aria-current', async ({ page }) => {
    await page.goto('/ar/kit');
    await page.getByTestId('locale-switcher-button').click();

    const arItem = page.getByTestId('locale-switcher-item-ar');
    await expect(arItem).toHaveAttribute('aria-current', 'page');

    const frItem = page.getByTestId('locale-switcher-item-fr');
    await expect(frItem).not.toHaveAttribute('aria-current', 'page');
  });

  test('clicking outside closes dropdown', async ({ page }) => {
    await page.goto('/fr/kit');
    await page.getByTestId('locale-switcher-button').click();
    await expect(page.getByTestId('locale-switcher-menu')).toBeVisible();

    await page.locator('main').click({ position: { x: 100, y: 100 } });

    await expect(page.getByTestId('locale-switcher-menu')).not.toBeVisible();
  });
});
```

### 2.2 Keyboard navigation

```ts
// apps/web/e2e/i18n/switcher-keyboard.all.spec.ts
import { test, expect } from '../fixtures/i18n';

test.describe('Locale switcher keyboard @critical', () => {
  test('opens with Enter, navigates with arrows, selects with Enter', async ({ page }) => {
    await page.goto('/fr/kit');

    const switcher = page.getByTestId('locale-switcher-button');
    await switcher.focus();
    await page.keyboard.press('Enter');

    const menu = page.getByTestId('locale-switcher-menu');
    await expect(menu).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('locale-switcher-item-ar')).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('locale-switcher-item-en')).toBeFocused();

    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/en\/kit/);
  });

  test('Escape closes dropdown', async ({ page }) => {
    await page.goto('/fr/kit');
    await page.getByTestId('locale-switcher-button').focus();
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('locale-switcher-menu')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByTestId('locale-switcher-menu')).not.toBeVisible();
    await expect(page.getByTestId('locale-switcher-button')).toBeFocused();
  });

  test('Tab cycles within open dropdown', async ({ page }) => {
    await page.goto('/fr/kit');
    await page.getByTestId('locale-switcher-button').focus();
    await page.keyboard.press('Enter');

    await page.keyboard.press('Tab');
    await expect(page.getByTestId('locale-switcher-item-ar')).toBeFocused();
  });

  test('Space toggles like Enter', async ({ page }) => {
    await page.goto('/fr/kit');
    await page.getByTestId('locale-switcher-button').focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('locale-switcher-menu')).toBeVisible();
  });
});
```

## 3. Cookie persistence

### 3.1 `e2e/i18n/cookie-persistence.all.spec.ts`

```ts
// apps/web/e2e/i18n/cookie-persistence.all.spec.ts
import { test, expect } from '../fixtures/i18n';

test.describe('NEXT_LOCALE cookie @critical', () => {
  test('cookie persists across reload', async ({ page, context }) => {
    await page.goto('/fr/kit');

    await page.getByTestId('locale-switcher-button').click();
    await page.getByTestId('locale-switcher-item-ar').click();
    await page.waitForURL(/\/ar\/kit/);

    const cookies = await context.cookies();
    const localeCookie = cookies.find(c => c.name === 'NEXT_LOCALE');
    expect(localeCookie).toBeDefined();
    expect(localeCookie?.value).toBe('ar');
    expect(localeCookie?.path).toBe('/');

    await page.reload();
    await expect(page).toHaveURL(/\/ar\/kit/);
  });

  test('cookie max-age is 1 year', async ({ page, context }) => {
    await page.goto('/fr/kit');
    await page.getByTestId('locale-switcher-button').click();
    await page.getByTestId('locale-switcher-item-ar').click();

    const cookies = await context.cookies();
    const localeCookie = cookies.find(c => c.name === 'NEXT_LOCALE');
    expect(localeCookie).toBeDefined();
    const expectedExpiry = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 365);
    expect(Math.abs((localeCookie!.expires ?? 0) - expectedExpiry)).toBeLessThan(60);
  });

  test('cookie is SameSite=Lax', async ({ page, context }) => {
    await page.goto('/fr/kit');
    await page.getByTestId('locale-switcher-button').click();
    await page.getByTestId('locale-switcher-item-ar').click();

    const cookies = await context.cookies();
    const localeCookie = cookies.find(c => c.name === 'NEXT_LOCALE');
    expect(localeCookie?.sameSite).toMatch(/Lax/i);
  });

  test('cookie is read on next visit (root URL)', async ({ context, baseURL }) => {
    await context.addCookies([
      {
        name: 'NEXT_LOCALE',
        value: 'ar',
        url: baseURL!,
      },
    ]);

    const page = await context.newPage();
    await page.goto('/');

    await expect(page).toHaveURL(/\/ar\/?/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });

  test('cookie cleared → falls back to Accept-Language', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'en-US',
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const page = await context.newPage();

    await page.goto('http://localhost:3000/');

    await expect(page).toHaveURL(/\/en\/?/);
    await context.close();
  });
});
```

## 4. RTL layout audit

### 4.1 `e2e/i18n/rtl-layout.ar.spec.ts`

```ts
// apps/web/e2e/i18n/rtl-layout.ar.spec.ts
import { test, expect } from '../fixtures/i18n';

test.describe('RTL layout AR @critical @visual', () => {
  test('html[dir=rtl] on AR pages', async ({ page, expectLocaleAttrs }) => {
    await page.goto('/ar/');
    await expectLocaleAttrs('ar');

    await page.goto('/ar/kit');
    await expectLocaleAttrs('ar');

    await page.goto('/ar/maison');
    await expectLocaleAttrs('ar');
  });

  test('navigation order is right-to-left visually', async ({ page }) => {
    await page.goto('/ar/');
    const nav = page.getByRole('navigation');

    const firstItem = nav.locator('a').first();
    const lastItem = nav.locator('a').last();

    const firstBox = await firstItem.boundingBox();
    const lastBox = await lastItem.boundingBox();
    expect(firstBox).not.toBeNull();
    expect(lastBox).not.toBeNull();

    expect(firstBox!.x).toBeGreaterThan(lastBox!.x);
  });

  test('logical properties: padding-inline-start works in RTL', async ({ page }) => {
    await page.goto('/ar/kit');
    const card = page.getByTestId('kit-product-card').first();

    const paddingLeft = await card.evaluate((el) => {
      return window.getComputedStyle(el).paddingLeft;
    });
    const paddingRight = await card.evaluate((el) => {
      return window.getComputedStyle(el).paddingRight;
    });

    expect(paddingLeft).not.toBe(paddingRight);
  });

  test('text-align is right (start) on Arabic content', async ({ page }) => {
    await page.goto('/ar/');
    const heading = page.getByRole('heading', { level: 1 });

    const computedAlign = await heading.evaluate(el => window.getComputedStyle(el).textAlign);
    // RTL : textAlign computed 'right' ou 'start'
    expect(['right', 'start']).toContain(computedAlign);
  });

  test('Tailwind logical classes work (ms- inverts in RTL)', async ({ page }) => {
    await page.goto('/ar/');
    const itemWithMs = page.locator('[data-testid="nav-item-marketing"]').first();
    if (await itemWithMs.count() === 0) return;

    const marginLeft = await itemWithMs.evaluate(el => window.getComputedStyle(el).marginLeft);
    const marginRight = await itemWithMs.evaluate(el => window.getComputedStyle(el).marginRight);

    // En RTL, marginLeft devrait être 0 et marginRight la valeur
    expect(parseFloat(marginRight)).toBeGreaterThan(0);
  });
});
```

### 4.2 Comparaison FR vs AR (audit visuel)

```ts
// apps/web/e2e/i18n/rtl-vs-ltr.all.spec.ts
import { test, expect } from '../fixtures/i18n';

test.describe('FR vs AR layout comparison @visual', () => {
  test('hero layout mirrors correctly', async ({ page }) => {
    await page.goto('/fr/');
    const frHero = await page.getByTestId('hero-section').boundingBox();

    await page.goto('/ar/');
    const arHero = await page.getByTestId('hero-section').boundingBox();

    expect(frHero?.width).toBeCloseTo(arHero?.width ?? 0, 0);
    expect(frHero?.height).toBeCloseTo(arHero?.height ?? 0, -1);
  });

  test('header height is consistent across locales', async ({ page }) => {
    const heights: number[] = [];

    for (const locale of ['fr', 'ar', 'en']) {
      await page.goto(`/${locale}/`);
      const header = page.locator('header');
      const box = await header.boundingBox();
      heights.push(box?.height ?? 0);
    }

    const min = Math.min(...heights);
    const max = Math.max(...heights);
    expect(max - min).toBeLessThan(10);
  });
});
```

## 5. Wizard checkout par locale

### 5.1 `e2e/i18n/wizard-checkout.all.spec.ts`

```ts
// apps/web/e2e/i18n/wizard-checkout.all.spec.ts
import { test, expect } from '../fixtures/i18n';

const LOCALES = ['fr', 'ar', 'en'] as const;

for (const locale of LOCALES) {
  test.describe(`Wizard checkout ${locale} @critical`, () => {
    test(`step 1 (shipping) renders in ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/checkout`);

      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
      const headingText = await heading.textContent();
      expect(headingText).toBeTruthy();
      expect(headingText!.length).toBeGreaterThan(3);

      if (locale === 'ar') {
        expect(headingText).toMatch(/[؀-ۿ]/);
      }
      if (locale === 'en') {
        expect(headingText).toMatch(/[a-z]/i);
      }
    });

    test(`step 1 → step 2 transition (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}/checkout`);

      await page.getByTestId('checkout-name').fill('Sara Test');
      await page.getByTestId('checkout-phone').fill('0612345678');
      await page.getByTestId('checkout-address').fill('123 rue de Test');
      await page.getByTestId('checkout-city').fill('Casablanca');

      await page.getByTestId('checkout-next-step').click();

      await expect(page.getByTestId('checkout-step-2')).toBeVisible({ timeout: 5000 });
    });

    test(`form validation errors are localized (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}/checkout`);

      await page.getByTestId('checkout-next-step').click();

      const error = page.getByTestId('checkout-error-phone');
      await expect(error).toBeVisible();
      const errorText = await error.textContent();

      if (locale === 'ar') {
        expect(errorText).toMatch(/[؀-ۿ]/);
      }
      if (locale === 'en') {
        expect(errorText?.toLowerCase()).toMatch(/required|invalid|missing/);
      }
      if (locale === 'fr') {
        expect(errorText?.toLowerCase()).toMatch(/requis|obligatoire|invalide/);
      }
    });

    test(`currency format MAD (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}/checkout`);
      const total = page.getByTestId('checkout-total');
      const totalText = await total.textContent();

      expect(totalText).toMatch(/MAD|درهم|dh/i);

      if (locale === 'fr') {
        expect(totalText).toMatch(/,/); // virgule décimale
      }
      if (locale === 'en') {
        expect(totalText).toMatch(/\./); // point décimal
      }
    });
  });
}
```

## 6. hreflang tags

### 6.1 `e2e/i18n/hreflang.all.spec.ts`

```ts
// apps/web/e2e/i18n/hreflang.all.spec.ts
import { test, expect } from '../fixtures/i18n';

test.describe('hreflang tags SEO @critical', () => {
  test('home page has hreflang for all locales', async ({ page }) => {
    await page.goto('/fr/');

    const frLink = page.locator('link[rel="alternate"][hreflang="fr"]');
    const arLink = page.locator('link[rel="alternate"][hreflang="ar"]');
    const enLink = page.locator('link[rel="alternate"][hreflang="en"]');
    const xDefault = page.locator('link[rel="alternate"][hreflang="x-default"]');

    await expect(frLink).toHaveCount(1);
    await expect(arLink).toHaveCount(1);
    await expect(enLink).toHaveCount(1);
    await expect(xDefault).toHaveCount(1);
  });

  test('hreflang URLs point to correct locales', async ({ page }) => {
    await page.goto('/fr/kit');

    const frHref = await page.locator('link[rel="alternate"][hreflang="fr"]').getAttribute('href');
    const arHref = await page.locator('link[rel="alternate"][hreflang="ar"]').getAttribute('href');
    const enHref = await page.locator('link[rel="alternate"][hreflang="en"]').getAttribute('href');

    expect(frHref).toMatch(/\/fr\/kit/);
    expect(arHref).toMatch(/\/ar\/kit/);
    expect(enHref).toMatch(/\/en\/kit/);
  });

  test('x-default points to default locale (fr)', async ({ page }) => {
    await page.goto('/fr/kit');
    const xDefaultHref = await page.locator('link[rel="alternate"][hreflang="x-default"]').getAttribute('href');
    expect(xDefaultHref).toMatch(/\/fr\/kit/);
  });

  test('canonical points to current locale URL', async ({ page }) => {
    await page.goto('/ar/kit');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toMatch(/\/ar\/kit/);
  });

  test('og:locale meta is correct per locale', async ({ page }) => {
    await page.goto('/ar/');
    const ogLocale = await page.locator('meta[property="og:locale"]').getAttribute('content');
    expect(ogLocale).toMatch(/^ar/);

    await page.goto('/en/');
    const ogLocaleEn = await page.locator('meta[property="og:locale"]').getAttribute('content');
    expect(ogLocaleEn).toMatch(/^en/);
  });

  test('og:locale:alternate for other locales', async ({ page }) => {
    await page.goto('/fr/');
    const alternates = page.locator('meta[property="og:locale:alternate"]');
    const count = await alternates.count();
    expect(count).toBeGreaterThanOrEqual(2);

    const contents = await alternates.evaluateAll((els) =>
      els.map(el => el.getAttribute('content')),
    );
    expect(contents).toEqual(expect.arrayContaining([
      expect.stringMatching(/^ar/),
      expect.stringMatching(/^en/),
    ]));
  });
});
```

## 7. 404 page localisée

### 7.1 `e2e/i18n/404.all.spec.ts`

```ts
// apps/web/e2e/i18n/404.all.spec.ts
import { test, expect } from '../fixtures/i18n';

test.describe('404 localized @critical', () => {
  test('/fr/page-inexistante shows FR 404', async ({ page }) => {
    const response = await page.goto('/fr/page-inexistante-xyz');
    expect(response?.status()).toBe(404);

    const heading = page.getByRole('heading', { level: 1 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/page introuvable|non trouvée|404/);
  });

  test('/ar/page-inexistante shows AR 404', async ({ page }) => {
    const response = await page.goto('/ar/page-inexistante-xyz');
    expect(response?.status()).toBe(404);

    const heading = page.getByRole('heading', { level: 1 });
    const text = await heading.textContent();
    expect(text).toMatch(/[؀-ۿ]/);
  });

  test('/en/page-inexistante shows EN 404', async ({ page }) => {
    const response = await page.goto('/en/page-inexistante-xyz');
    expect(response?.status()).toBe(404);

    const heading = page.getByRole('heading', { level: 1 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/not found|page not found|404/);
  });

  test('404 page has localized "back to home" CTA', async ({ page }) => {
    await page.goto('/ar/page-inexistante');
    const cta = page.getByTestId('404-back-home-cta');
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute('href');
    expect(href).toMatch(/^\/ar\/?$/);
  });

  test('404 page has localized lang/dir', async ({ page, expectLocaleAttrs }) => {
    await page.goto('/ar/foo-bar');
    await expectLocaleAttrs('ar');

    await page.goto('/en/foo-bar');
    await expectLocaleAttrs('en');
  });

  test('unknown locale fallback to default 404', async ({ page }) => {
    const response = await page.goto('/de/kit');
    expect(response?.status()).toBe(404);
  });
});
```

## 8. Locale persistence dans session

### 8.1 `e2e/i18n/session-persistence.all.spec.ts`

```ts
// apps/web/e2e/i18n/session-persistence.all.spec.ts
import { test, expect } from '../fixtures/i18n';

test.describe('Locale persistence across pages @critical', () => {
  test('locale survives navigation between pages', async ({ page }) => {
    await page.goto('/ar/');

    await page.getByTestId('nav-link-kit').click();
    await expect(page).toHaveURL(/\/ar\/kit/);

    await page.getByTestId('nav-link-maison').click();
    await expect(page).toHaveURL(/\/ar\/maison/);

    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });

  test('logo link goes to localized home', async ({ page }) => {
    await page.goto('/ar/kit');
    await page.getByTestId('logo-home-link').click();
    await expect(page).toHaveURL(/\/ar\/?$/);
  });

  test('switching back and forth keeps state', async ({ page }) => {
    await page.goto('/fr/kit');

    await page.getByTestId('locale-switcher-button').click();
    await page.getByTestId('locale-switcher-item-ar').click();
    await expect(page).toHaveURL(/\/ar\/kit/);

    await page.getByTestId('locale-switcher-button').click();
    await page.getByTestId('locale-switcher-item-fr').click();
    await expect(page).toHaveURL(/\/fr\/kit/);

    await page.getByTestId('locale-switcher-button').click();
    await page.getByTestId('locale-switcher-item-en').click();
    await expect(page).toHaveURL(/\/en\/kit/);
  });
});
```

## 9. Footer / global UI

### 9.1 `e2e/i18n/footer-localized.all.spec.ts`

```ts
// apps/web/e2e/i18n/footer-localized.all.spec.ts
import { test, expect } from '../fixtures/i18n';

test.describe('Footer localized @critical', () => {
  test('footer text is localized', async ({ page }) => {
    await page.goto('/fr/');
    const frFooter = await page.locator('footer').textContent();
    expect(frFooter?.toLowerCase()).toMatch(/conditions|mentions|cookies/);

    await page.goto('/ar/');
    const arFooter = await page.locator('footer').textContent();
    expect(arFooter).toMatch(/[؀-ۿ]/);
  });

  test('legal page links are localized', async ({ page }) => {
    await page.goto('/ar/');
    const cgvLink = page.getByTestId('footer-cgv-link');
    const href = await cgvLink.getAttribute('href');
    expect(href).toMatch(/^\/ar\/legal\//);
  });
});
```

## 10. Admin i18n dashboard E2E

### 10.1 `e2e/admin/i18n-dashboard.fr.spec.ts`

```ts
// apps/web/e2e/admin/i18n-dashboard.fr.spec.ts
import { test, expect } from '../fixtures/i18n';

test.describe('Admin i18n dashboard @admin', () => {
  test.use({
    storageState: 'e2e/fixtures/admin-auth.json',
  });

  test('shows coverage by locale', async ({ page }) => {
    await page.goto('/admin/i18n/dashboard');

    await expect(page.getByTestId('coverage-fr')).toBeVisible();
    await expect(page.getByTestId('coverage-ar')).toBeVisible();
    await expect(page.getByTestId('coverage-en')).toBeVisible();
  });

  test('opens edit modal on key click', async ({ page }) => {
    await page.goto('/admin/i18n/dashboard');

    await page.getByTestId('key-marketing.hero.title').click();
    await expect(page.getByTestId('edit-translation-modal')).toBeVisible();

    await expect(page.getByTestId('edit-fr-input')).toHaveValue(/.+/);
    await expect(page.getByTestId('edit-ar-input')).toHaveValue(/.+/);
  });

  test('upserts translation and refreshes', async ({ page }) => {
    await page.goto('/admin/i18n/dashboard');

    await page.getByTestId('key-marketing.hero.title').click();
    await page.getByTestId('edit-ar-input').fill('قيمة جديدة للاختبار');
    await page.getByTestId('save-translation-button').click();

    await expect(page.getByText(/enregistré|success/i)).toBeVisible({ timeout: 3000 });
  });
});
```

## 11. data-testid conventions

Pour rendre les E2E robustes (jamais `getByText('Découvrir')` car FR-dépendant), on utilise des `data-testid` stables :

```tsx
// Header
<button data-testid="locale-switcher-button">...</button>
<ul data-testid="locale-switcher-menu">
  <li data-testid="locale-switcher-item-fr">...</li>
  <li data-testid="locale-switcher-item-ar">...</li>
  <li data-testid="locale-switcher-item-en">...</li>
</ul>

// Navigation
<a data-testid="nav-link-kit" href={`/${locale}/kit`}>...</a>
<a data-testid="logo-home-link" href={`/${locale}/`}>...</a>

// Checkout
<input data-testid="checkout-name" />
<input data-testid="checkout-phone" />
<button data-testid="checkout-next-step">...</button>
<div data-testid="checkout-total">...</div>
<div data-testid="checkout-error-phone">...</div>

// Page 404
<a data-testid="404-back-home-cta">...</a>

// Hero
<section data-testid="hero-section">...</section>

// Admin
<div data-testid="coverage-fr">100%</div>
<button data-testid="key-marketing.hero.title">...</button>
<dialog data-testid="edit-translation-modal">...</dialog>
<input data-testid="edit-fr-input" />
<button data-testid="save-translation-button">...</button>
```

## 12. Tag conventions

| Tag | Quand l'utiliser | Pipeline |
|---|---|---|
| `@critical` | Tests bloquants pour la prod | PR + nightly |
| `@smoke` | Tests ultra-rapides, sanity check | Pre-merge |
| `@visual` | Tests à comparaison visuelle | PR + nightly |
| `@a11y` | Tests d'accessibilité (axe) | PR + nightly |
| `@admin` | Tests admin (auth requise) | Nightly |

Lancer une catégorie :
```bash
pnpm --filter @femiglow/web test:e2e:critical   # tags @critical
pnpm --filter @femiglow/web test:visual         # tags @visual
```

## 13. Anti-patterns

1. **`page.getByText('Découvrir')`** — fragile FR-only. Utiliser `data-testid`.
2. **Hardcode `/fr/...`** dans test "all locales" — utiliser variable `locale`.
3. **Pas attendre la navigation** — utiliser `page.waitForURL(...)`.
4. **Réutilise la même page entre tests** — `test.beforeEach` reset.
5. **Pas de retry** : `retries: 0` strict, sinon flaky toléré.
6. **Pas tester AR** : RTL bugs invisibles.
7. **`page.click('button')` sans selector précis** — multiple buttons → flaky.
8. **`setTimeout(...)` au lieu de `waitFor*`** — déterminisme zéro.
9. **Pas vérifier le `status()`** sur 404/500.
10. **Mocking par MSW dans Playwright** — préférer le vrai serveur Next + DB de test.

## 14. Debug

```bash
# Mode headed
pnpm --filter @femiglow/web test:e2e:headed -- e2e/i18n

# Mode debug
PWDEBUG=1 pnpm --filter @femiglow/web test:e2e -- e2e/i18n/switcher.all.spec.ts

# Trace viewer après échec
pnpm --filter @femiglow/web exec playwright show-trace test-results/.../trace.zip

# HTML report
pnpm --filter @femiglow/web test:e2e:report
```

## 15. Commandes

```bash
# Tous les tests E2E i18n (3 locales)
pnpm --filter @femiglow/web test:e2e -- e2e/i18n

# Une locale uniquement
pnpm --filter @femiglow/web test:e2e --project=chromium-ar

# Smoke @critical only
pnpm --filter @femiglow/web test:e2e:critical

# Avec retry CI
CI=1 pnpm --filter @femiglow/web test:e2e
```

## 16. Checklist E2E i18n

- [ ] Test couvre les 3 locales (fr/ar/en) via boucle ou multi-spec
- [ ] Utilise `data-testid` jamais `getByText` pour assertion stable
- [ ] Tag `@critical` sur les flows bloquants
- [ ] Vérifie `lang`, `dir` sur `<html>`
- [ ] Vérifie hreflang tags sur pages publiques
- [ ] Test cookie NEXT_LOCALE max-age, SameSite, path
- [ ] Test keyboard navigation (Tab, Enter, Esc, Arrow)
- [ ] Test 404 localisée
- [ ] Test layout RTL via boundingBox
- [ ] `expect(page).toHaveURL(...)` au lieu de waiting arbitraire
- [ ] Pas de `setTimeout` dans le test
- [ ] HTML report propre (titres, structure)
- [ ] Trace activée sur échec (`trace: 'retain-on-failure'`)
