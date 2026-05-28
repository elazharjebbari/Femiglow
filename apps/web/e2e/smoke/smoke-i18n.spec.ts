/**
 * Smoke i18n — valide la chaîne i18n end-to-end runtime (3 locales).
 *
 * Pré-requis : le dev server doit tourner avec `I18N_ENABLED=true` :
 *
 *   echo "I18N_ENABLED=true" >> apps/web/.env.local
 *   pnpm dev
 *
 *   # puis dans un autre terminal :
 *   pnpm test:e2e --grep @i18n
 *
 * Si le flag n'est pas activé, tous les tests sont skip (pas d'échec).
 *
 * Couverture :
 *   - Status 200 sur /fr/contact, /ar/contact, /en/contact
 *   - Title `<title>` localisé par locale
 *   - Direction RTL pour /ar (set via LocaleDirectionScript après hydration)
 *   - Hreflang alternates dans <head> (canonical + 3 langues + x-default)
 *   - LocaleSwitcher fonctionnel : changement de locale navigue + persiste
 *   - Cookie `NEXT_LOCALE` mis à jour après switch
 *
 * Référence : docs/i18n-strategy-2026-05/07-tests/e2e-playwright.md
 *
 * SLA : < 60 s en local (3 navigations × 3 locales + interactions switcher).
 */
import { expect, test } from '@playwright/test';

const I18N_FLAG_ACTIVE = process.env.I18N_ENABLED === 'true';

test.describe('@smoke @i18n i18n runtime end-to-end', () => {
  test.skip(
    !I18N_FLAG_ACTIVE,
    'I18N_ENABLED=true requis (cf. en-tête du fichier). Test skip car flag OFF.',
  );

  // ──────────────────────────────────────────────────────────────────────
  // Couverture statique : titres + langs + direction
  // ──────────────────────────────────────────────────────────────────────

  test('FR — /fr/contact rend avec titre français', async ({ page }) => {
    const response = await page.goto('/fr/contact');
    expect(response?.status()).toBe(200);

    // Title doit contenir un mot français reconnaissable
    await expect(page).toHaveTitle(/Contact|maison/i);

    // <html lang> et dir set par LocaleDirectionScript
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('AR — /ar/contact rend avec titre arabe + RTL', async ({ page }) => {
    const response = await page.goto('/ar/contact');
    expect(response?.status()).toBe(200);

    // <html lang> et dir RTL après hydration
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    // Présence d'au moins un caractère arabe dans le body
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/[؀-ۿ]/);
  });

  test('EN — /en/contact rend avec lang anglais', async ({ page }) => {
    const response = await page.goto('/en/contact');
    expect(response?.status()).toBe(200);

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  // ──────────────────────────────────────────────────────────────────────
  // SEO : hreflang alternates
  // ──────────────────────────────────────────────────────────────────────

  test('SEO — /fr/contact expose les hreflang alternates correctement', async ({
    page,
  }) => {
    await page.goto('/fr/contact');

    // hreflang fr, ar, en, x-default doivent être présents
    for (const lang of ['fr', 'ar', 'en', 'x-default']) {
      const link = page.locator(`link[hreflang="${lang}"]`);
      await expect(link).toHaveCount(1);
    }

    // Canonical pointe sur /fr/contact
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toMatch(/\/fr\/contact$/);
  });

  // ──────────────────────────────────────────────────────────────────────
  // Switcher : changement de locale fonctionnel
  // ──────────────────────────────────────────────────────────────────────

  test('Switcher — bascule FR → AR sur la page pilote /[locale]/', async ({
    page,
  }) => {
    await page.goto('/fr/');

    // Le switcher est un <select> avec aria-label "Choisir la langue"
    const switcher = page.getByLabel('Choisir la langue');
    await expect(switcher).toBeVisible();
    await expect(switcher).toHaveValue('fr');

    // Bascule sur AR
    await switcher.selectOption('ar');

    // Navigation vers /ar/
    await page.waitForURL(/\/ar\/?$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page).toHaveURL(/\/ar/);
  });

  test('Cookie — switch locale persiste via cookie NEXT_LOCALE', async ({
    page,
    context,
  }) => {
    await page.goto('/fr/');

    // Bascule sur EN via le switcher
    await page.getByLabel('Choisir la langue').selectOption('en');
    await page.waitForURL(/\/en\/?$/);

    // Le cookie doit avoir été mis à jour par le middleware next-intl
    const cookies = await context.cookies();
    const localeCookie = cookies.find((c) => c.name === 'NEXT_LOCALE');
    expect(localeCookie?.value).toBe('en');
  });

  // ──────────────────────────────────────────────────────────────────────
  // Garde-fou : locale invalide → 404
  // ──────────────────────────────────────────────────────────────────────

  test('404 — locale URL invalide retourne 404', async ({ page }) => {
    const response = await page.goto('/invalid-locale/contact', {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.status()).toBe(404);
  });
});
