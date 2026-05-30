/**
 * Page Object Model — Page /kit (page hôte du widget).
 *
 * Pour les tests E2E qui démarrent en visiteur sur /kit.
 */
import { type Locator, type Page, expect } from '@playwright/test';

export class KitPagePOM {
  constructor(public readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/kit');
    await expect(this.heroTitle()).toBeVisible({ timeout: 10_000 });
  }

  heroTitle(): Locator {
    return this.page.getByRole('heading', { name: /pack femiglow/i, level: 1 });
  }

  ctaCommander(): Locator {
    return this.page.getByRole('button', { name: /commander le rituel/i }).first();
  }

  reviewsRating(): Locator {
    return this.page.getByRole('link', { name: /4[.,]\d.*sur 5/i });
  }
}
