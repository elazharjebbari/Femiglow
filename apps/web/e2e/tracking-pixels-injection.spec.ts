/**
 * E2E — Vérifie que les pixels tracking (GA4, GTM, Google Ads) sont
 * injectés dans le DOM après mount du PixelLoader.
 *
 * Pré-requis : tracking_settings.consent_default_granted=true et
 * consent_banner_enabled=false (cas actuel du serveur).
 */
import { expect, test } from '@playwright/test';

test.describe('Tracking pixels injection (no consent banner)', () => {
  test('GA4, GTM et Google Ads sont injectés dans le head', async ({ page }) => {
    await page.goto('/kit', { waitUntil: 'domcontentloaded' });
    // PixelLoader attend `requestIdleCallback` puis injecte. Délai large.
    await page.waitForTimeout(3000);

    // Vérifie la présence des scripts injectés (data-tracking-pixel="<kind>")
    const injectedKinds = await page.$$eval(
      'script[data-tracking-pixel]',
      (els) =>
        els.map((el) => el.getAttribute('data-tracking-pixel')).filter(Boolean),
    );

    expect(injectedKinds).toContain('google_ga4');
    expect(injectedKinds).toContain('gtm');
    expect(injectedKinds).toContain('google_ads');

    // Vérifie que gtag.js est chargé pour Google Ads
    const adsScript = await page.$$eval('script[src]', (els) =>
      els
        .map((el) => el.getAttribute('src'))
        .filter((src): src is string => Boolean(src && src.includes('googletagmanager.com/gtag/js'))),
    );
    expect(adsScript.length).toBeGreaterThan(0);

    // Snapshot du DOM pour debug visuel
    await page.screenshot({
      path: 'test-results/tracking-pixels-injection.png',
      fullPage: false,
    });
  });
});
