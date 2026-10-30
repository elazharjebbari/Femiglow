import { expect, test } from '@playwright/test';

const promoPayload = {
  enabled: true,
  dateLabel: '18 mai 2026',
  dateShort: '18 mai',
  cityLabel: 'Casablanca',
  message: 'Offre du 18 mai - Casablanca',
  tags: [
    { key: 'discount', label: '-25%', icon: 'BadgePercent' },
    { key: 'free_shipping', label: 'Livraison gratuite', icon: 'Truck' },
    { key: 'cod', label: 'Paiement a la livraison', icon: 'HandCoins' },
    { key: 'inspect_before_pay', label: 'Verifiez avant de payer', icon: 'ShieldCheck' },
    { key: 'morocco_delivery', label: 'Partout au Maroc', icon: 'MapPinned' },
  ],
  discountPct: 25,
  ctaLabel: 'Commander',
  ctaHref: '/kit#commander-femiglow',
  ariaLabel: 'Offre FemiGlow du jour',
  theme: 'ink',
  density: 'compact',
  motion: 'none',
  dismissible: true,
  dismissMode: 'session',
  campaignKey: 'geo_promo_kit_default',
};

test.describe('Geo promo slide header', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/promo/location', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(promoPayload),
      });
    });
  });

  // NB : `/kit` n'affiche le bandeau que servi par l'arbre legacy
  // `(marketing)/kit` (i18n désactivée). Avec I18N_ENABLED (+ réécriture
  // KIT_ROOT_REWRITE), `/kit` est l'arbre localisé : pas de bandeau.
  test('appears on /kit with tags and scroll CTA', async ({ page }) => {
    await page.goto('/kit?cta=scroll');

    const banner = page.getByTestId('geo-promo-slide-header');
    await expect(banner).toBeVisible();
    await expect(banner.getByText('Offre du 18 mai - Casablanca')).toBeVisible();
    await expect(banner.getByText('-25%')).toBeVisible();
    await expect(banner.getByText('Livraison gratuite')).toBeVisible();
    await expect(banner.getByText('Paiement a la livraison')).toBeVisible();
    await expect(banner.getByText('Verifiez avant de payer')).toBeVisible();
    await expect(banner.getByText('Partout au Maroc')).toBeVisible();

    await banner.getByRole('link', { name: 'Commander' }).click();
    await expect(page.locator('#commander-femiglow')).toBeInViewport();
  });

  test('does not appear on the localized kit tree (/fr/kit)', async ({ page }) => {
    // Kit CRO v2 — l'arbre localisé (y compris `/kit` réécrit vers `/fr/kit`)
    // ne rend pas le bandeau : décision serveur `promoBannerEnabled=false`,
    // comme en production avant la réécriture.
    await page.goto('/fr/kit?cta=scroll');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByTestId('geo-promo-slide-header')).toHaveCount(0);
  });

  test('does not appear outside /kit', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('geo-promo-slide-header')).toHaveCount(0);
  });

  test('dismissal persists after reload', async ({ page }) => {
    await page.goto('/kit?cta=scroll');
    await expect(page.getByTestId('geo-promo-slide-header')).toBeVisible();
    await page.getByRole('button', { name: "Fermer l'offre" }).click();
    await expect(page.getByTestId('geo-promo-slide-header')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('geo-promo-slide-header')).toHaveCount(0);
  });
});
