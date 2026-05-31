/**
 * Playwright — Locale Switcher V2, invariants cœur (lot L12).
 *
 * Couvre les scénarios du plan `docs/locale-switcher-v2/07-tests/
 * playwright-plan.csv` qui prouvent les invariants structurels de la bascule
 * sans reload :
 *
 *   PW-01  INV-1   bascule FR→AR sans reload (sentinelle window)
 *   PW-02  INV-2   `dir` passe à rtl + `lang` ar après bascule
 *   PW-03  INV-3   scroll préservé (±2px) à travers la bascule
 *   PW-04  INV-4   querystring/UTM intégralement préservés
 *   PW-34  INV-2   aucun frame `lang=ar && dir=ltr` (pas de flash LTR)
 *   PW-21  INV-7/1 reduced-motion : bascule instantanée, pas de voile
 *   PW-26  INV-10  région aria-live annonce le changement (texte arabe)
 *   PW-27  INV-10  axe 0 serious/critical sur /fr/kit
 *   PW-28  INV-10/2 axe 0 serious/critical sur /ar/kit (RTL)
 *   PW-29  INV-10  axe 0 serious/critical sur /en/kit
 *
 * Pré-requis (sinon tous les tests sont SKIP, pas d'échec) :
 *
 *   echo "I18N_ENABLED=true" >> apps/web/.env.local
 *   echo "NEXT_PUBLIC_LOCALE_SWITCHER_V2=true" >> apps/web/.env.local
 *   pnpm build && pnpm start          # le flag V2 est build-time (NEXT_PUBLIC)
 *   # autre terminal :
 *   pnpm test:e2e --grep @locale-switch-core
 *
 * @see docs/locale-switcher-v2/CONTRACT.md INV-1..INV-10
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const TRUTHY = new Set(['true', '1', 'on', 'yes', 'enabled']);
function flagOn(v: string | undefined): boolean {
  return v ? TRUTHY.has(v.toLowerCase().trim()) : false;
}

const V2_ACTIVE =
  process.env.I18N_ENABLED === 'true' &&
  flagOn(process.env.NEXT_PUBLIC_LOCALE_SWITCHER_V2);

/** Bascule FR→AR via le dropdown du Header. Ne fait aucune assertion. */
async function switchToArabic(page: Page): Promise<void> {
  const trigger = page.getByTestId('locale-switcher-trigger').first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByTestId('locale-switcher-menu')).toBeVisible();
  await page.getByTestId('locale-switcher-item-ar').click();
}

const ARABIC_RE = /[؀-ۿ]/;

test.describe('@locale-switch-core Bascule V2 — invariants cœur', () => {
  test.skip(
    !V2_ACTIVE,
    'I18N_ENABLED=true + NEXT_PUBLIC_LOCALE_SWITCHER_V2=true requis (cf. en-tête).',
  );

  // ── PW-01 — INV-1 : aucune navigation document (pas de reload) ──────────
  test('PW-01 — FR→AR ne recharge jamais la page', async ({ page }) => {
    await page.goto('/fr/kit');
    // Sentinelle : une variable de fenêtre survit à une nav SPA, mais serait
    // effacée par un hard reload du document.
    await page.evaluate(() => {
      (window as unknown as { __noReload?: string }).__noReload = 'kept';
    });

    await switchToArabic(page);
    await page.waitForURL(/\/ar\/kit/);

    const sentinel = await page.evaluate(
      () => (window as unknown as { __noReload?: string }).__noReload,
    );
    expect(sentinel, 'la page a été rechargée (sentinelle perdue)').toBe('kept');
  });

  // ── PW-02 — INV-2 : dir=rtl + lang=ar après bascule ─────────────────────
  test('PW-02 — FR→AR bascule dir=rtl et lang=ar', async ({ page }) => {
    await page.goto('/fr/kit');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    await switchToArabic(page);
    await page.waitForURL(/\/ar\/kit/);

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });

  // ── PW-03 — INV-3 : scroll préservé (±2px) ──────────────────────────────
  test('PW-03 — scroll préservé à travers la bascule', async ({ page }) => {
    await page.goto('/fr/kit');
    await page.evaluate(() => window.scrollTo(0, 1200));
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(0);

    await switchToArabic(page);
    await page.waitForURL(/\/ar\/kit/);

    const after = await page.evaluate(() => window.scrollY);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(2);
  });

  // ── PW-04 — INV-4 : querystring/UTM intégralement préservés ─────────────
  test('PW-04 — UTM/querystring préservés sur la bascule', async ({ page }) => {
    await page.goto('/fr/kit?utm_source=meta&utm_campaign=glow');
    await switchToArabic(page);
    await page.waitForURL(/\/ar\/kit/);

    const url = new URL(page.url());
    expect(url.pathname).toBe('/ar/kit');
    expect(url.searchParams.get('utm_source')).toBe('meta');
    expect(url.searchParams.get('utm_campaign')).toBe('glow');
  });

  // ── PW-34 — INV-2 : aucun frame lang=ar && dir=ltr (pas de flash LTR) ────
  test('PW-34 — aucun flash LTR pendant la chorégraphie RTL', async ({
    page,
  }) => {
    await page.goto('/fr/kit');
    // Échantillonne (lang,dir) à chaque frame pendant la bascule.
    await page.evaluate(() => {
      const w = window as unknown as {
        __frames?: Array<{ lang: string; dir: string }>;
        __sampling?: boolean;
      };
      w.__frames = [];
      w.__sampling = true;
      const tick = () => {
        if (!w.__sampling) return;
        const h = document.documentElement;
        w.__frames!.push({
          lang: h.getAttribute('lang') ?? '',
          dir: h.getAttribute('dir') ?? '',
        });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await switchToArabic(page);
    await page.waitForURL(/\/ar\/kit/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    const frames = await page.evaluate(() => {
      const w = window as unknown as {
        __frames?: Array<{ lang: string; dir: string }>;
        __sampling?: boolean;
      };
      w.__sampling = false;
      return w.__frames ?? [];
    });
    const flash = frames.filter((f) => f.lang === 'ar' && f.dir === 'ltr');
    expect(
      flash.length,
      `frames incohérents lang=ar/dir=ltr : ${flash.length}`,
    ).toBe(0);
  });

  // ── PW-21 — INV-7/INV-1 : reduced-motion → bascule instantanée ──────────
  test('PW-21 — reduced-motion : bascule sans voile ni reload', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/fr/kit');
    await page.evaluate(() => {
      (window as unknown as { __noReload?: string }).__noReload = 'kept';
    });

    await switchToArabic(page);
    await page.waitForURL(/\/ar\/kit/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    // Aucun voile persistant observable (transition instantanée).
    await expect(page.getByTestId('locale-veil')).toHaveCount(0);
    const sentinel = await page.evaluate(
      () => (window as unknown as { __noReload?: string }).__noReload,
    );
    expect(sentinel).toBe('kept');
  });

  // ── PW-26 — INV-10 : aria-live annonce le changement (texte arabe) ──────
  test('PW-26 — la région aria-live annonce la nouvelle langue', async ({
    page,
  }) => {
    await page.goto('/fr/kit');
    const announcer = page.getByTestId('locale-live-announcer');
    await expect(announcer).toHaveAttribute('aria-live', 'polite');

    await switchToArabic(page);
    await page.waitForURL(/\/ar\/kit/);

    await expect
      .poll(async () => ARABIC_RE.test((await announcer.innerText()) ?? ''), {
        timeout: 5000,
      })
      .toBe(true);
  });

  // ── PW-27/28/29 — INV-10 : axe 0 serious/critical FR / AR / EN ──────────
  for (const locale of ['fr', 'ar', 'en'] as const) {
    test(`PW-2${locale === 'fr' ? 7 : locale === 'ar' ? 8 : 9} — axe 0 serious/critical sur /${locale}/kit`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/kit`);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(
        blocking,
        blocking.map((v) => `${v.id}: ${v.help}`).join('\n'),
      ).toHaveLength(0);
    });
  }
});
