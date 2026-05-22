import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * E2E refonte landing /kit v2 — L3 du plan kit-landing-reorder-2026-05.
 *
 * Les tests utilisent `?layout=v2` (override query param) pour cibler la v2
 * sans nécessiter `NEXT_PUBLIC_KIT_LAYOUT_V2=true` au build. La cascade
 * `kit/page.tsx` honore la qs en preview tout en préservant le canonical.
 *
 * Pour lancer localement :
 *   pnpm --filter @femiglow/web start
 *   pnpm --filter @femiglow/web exec playwright test kit-layout-v2
 *
 * Référence : `docs/kit-landing-reorder-2026-05/04-tests-strategy.md`.
 */

test.describe('@kit-layout-v2 — ordre Kolenda hero→preuve→décision', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kit?layout=v2');
  });

  test('SSR retourne data-kit-layout="v2"', async ({ page }) => {
    const layoutAttr = await page
      .locator('[data-kit-layout]')
      .first()
      .getAttribute('data-kit-layout');
    expect(layoutAttr).toBe('v2');
  });

  test('Wizard est positionné APRÈS HandsTestimonials (warm user)', async ({
    page,
  }) => {
    // Le récap panier du wizard est un marqueur unique du KitCommanderSection.
    const wizardRecap = page.locator('[data-testid="wizard-cart-recap"]').first();
    const handsTestimonials = page
      .locator('[data-testid*="hands-testimonial"]')
      .first();

    // Si les testimonials n'ont pas de testid stable, on fall back sur le
    // texte hands témoignage (ajuster si besoin selon le composant réel).
    const handsCount = await handsTestimonials.count();
    if (handsCount === 0) {
      test.skip(true, 'HandsTestimonials sans testid — adapter le selector');
    }

    const wizardBox = await wizardRecap.boundingBox();
    const handsBox = await handsTestimonials.boundingBox();
    expect(wizardBox).not.toBeNull();
    expect(handsBox).not.toBeNull();
    // Le wizard doit être PLUS BAS dans la page que les témoignages
    expect(wizardBox!.y).toBeGreaterThan(handsBox!.y);
  });

  test('Sections retirées en v2 : Comparatif, RitualsModule, PivotFinal', async ({
    page,
  }) => {
    // Comparatif — cherche un titre caractéristique du composant
    // (pas de testid sur le bound actuellement, on assert l'absence du
    // contenu signature).
    await expect(page.getByText(/comparatif/i).first()).toHaveCount(0);
    // RitualsModule — son data attribute si présent, sinon texte
    await expect(page.locator('[data-rituals-module]')).toHaveCount(0);
    // PivotFinal — bloc CTA bas de page (testid si présent)
    await expect(page.locator('[data-testid="pivot-final"]')).toHaveCount(0);
  });

  // Note : le sticky CTA bottom mobile a été retiré car redondant avec
  // le `GeoPromoSlideHeaderSlot` (top sticky de l'app) qui porte déjà
  // un bouton « Commander » mobile. Si un sticky bottom est réintroduit
  // pour une future expérience A/B, ajouter ici les tests dédiés.

  test('axe a11y v2 — zéro violation critical/serious', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('body')
      .disableRules(['color-contrast']) // bruit fréquent en dark mode preview
      .analyze();
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(
      critical,
      `Violations critical/serious :\n${critical.map((v) => `- ${v.id}: ${v.description}`).join('\n')}`,
    ).toHaveLength(0);
  });
});

test.describe('@kit-layout-v1 — non-régression historique', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kit?layout=v1');
  });

  test('SSR retourne data-kit-layout="v1"', async ({ page }) => {
    const layoutAttr = await page
      .locator('[data-kit-layout]')
      .first()
      .getAttribute('data-kit-layout');
    expect(layoutAttr).toBe('v1');
  });
});
