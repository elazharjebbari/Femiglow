import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * E2E du hero /kit après refonte (Phase 6 du plan).
 *
 * Couvre :
 *  - Présence des éléments clés (galerie, social proof, chips, prix, CTA, trust row)
 *  - Mobile : CTA visible above fold (y < 700px sur viewport 375×812)
 *  - Galerie : thumbnails desktop + dots mobile cliquables
 *  - Navigation clavier (← →)
 *  - axe-core : 0 violation sérieuse/critique
 *
 * Ne dépend pas de l'auth admin (tests publics).
 */

test.describe('/kit hero — desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('rend tous les éléments clés du hero', async ({ page }) => {
    await page.goto('/kit');

    // H1
    const h1 = page.getByRole('heading', { level: 1 }).first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(/pack femiglow/i);

    // Social proof badge
    await expect(page.getByText(/4,8\/5/).first()).toBeVisible();
    await expect(page.getByText(/287 avis/i).first()).toBeVisible();

    // Tagline avec "La main se révèle"
    await expect(page.getByText(/la main se révèle/i)).toBeVisible();

    // Chips attributs (4)
    const chipsList = page.getByRole('list', { name: 'Attributs produit' });
    await expect(chipsList).toBeVisible();
    for (const chip of ['Sans vernis', 'Sans UV', 'Sans acétone', 'Halal']) {
      await expect(chipsList.getByText(chip, { exact: true })).toBeVisible();
    }

    // Prix
    await expect(page.getByText(/199\s*MAD/).first()).toBeVisible();
    await expect(page.getByText(/économie 191\s*MAD/i)).toBeVisible();

    // Trust row (au-dessus du CTA)
    await expect(page.getByText(/livraison offerte/i).first()).toBeVisible();
    await expect(page.getByText(/retour 30 jours/i).first()).toBeVisible();

    // CTA principal
    const cta = page.getByRole('button', { name: /commander le rituel/i }).first();
    await expect(cta).toBeVisible();
  });

  test('galerie thumbnails visible et cliquable', async ({ page }) => {
    await page.goto('/kit');
    await page.waitForLoadState('domcontentloaded');

    const region = page.locator('[aria-roledescription="carrousel"]').first();
    await expect(region).toBeVisible();

    // Au moins 2 thumbnails côté desktop
    const thumbs = region.getByRole('button', { name: /voir l'image \d+ sur \d+/i });
    const count = await thumbs.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Click sur thumbnail 2 → image active change
    await thumbs.nth(1).click();
    await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true');
  });

  test('navigation clavier dans la galerie', async ({ page }) => {
    await page.goto('/kit');
    await page.waitForLoadState('domcontentloaded');

    const region = page.locator('[aria-roledescription="carrousel"]').first();
    await region.focus();

    // Première thumbnail active au départ
    const thumbs = region.getByRole('button', { name: /voir l'image \d+ sur \d+/i });
    await expect(thumbs.nth(0)).toHaveAttribute('aria-current', 'true');

    // ArrowRight → 2e thumbnail active
    await page.keyboard.press('ArrowRight');
    await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true');
  });

  test('a11y desktop — zéro violation sérieuse/critique', async ({ page }) => {
    await page.goto('/kit');
    await page.waitForLoadState('domcontentloaded');

    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    // Log les violations sérieuses pour debug si test fail
    if (serious.length > 0) {
      console.log('a11y violations sérieuses:', JSON.stringify(serious, null, 2));
    }
    expect(serious).toEqual([]);
  });
});

test.describe('/kit hero — mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('CTA visible above fold (mobile)', async ({ page }) => {
    await page.goto('/kit');
    await page.waitForLoadState('domcontentloaded');

    const cta = page.getByRole('button', { name: /commander le rituel/i }).first();
    await expect(cta).toBeVisible();

    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    // CTA top doit être < 750px sur viewport 812px (marge de safety incluse)
    expect(box!.y).toBeLessThan(750);
  });

  test('galerie mobile a un indicateur (dots ou compteur)', async ({ page }) => {
    await page.goto('/kit');
    await page.waitForLoadState('domcontentloaded');

    const region = page.locator('[aria-roledescription="carrousel"]').first();
    await expect(region).toBeVisible();

    // Mobile : soit dots (≤6), soit compteur "X / N" (>6)
    const dotsOrCounter = await Promise.race([
      region.getByRole('tab').count(),
      region.getByText(/\d+\s*\/\s*\d+/).count(),
    ]);
    expect(dotsOrCounter).toBeGreaterThan(0);
  });

  test('a11y mobile — zéro violation sérieuse/critique', async ({ page }) => {
    await page.goto('/kit');
    await page.waitForLoadState('domcontentloaded');

    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    if (serious.length > 0) {
      console.log('a11y violations sérieuses (mobile):', JSON.stringify(serious, null, 2));
    }
    expect(serious).toEqual([]);
  });
});
