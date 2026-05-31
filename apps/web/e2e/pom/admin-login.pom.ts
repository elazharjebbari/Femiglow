/**
 * Page Object Model — Login admin.
 *
 * Préférer `e2e/helpers/auth-admin.ts` (login via API, beaucoup plus rapide).
 * Ce POM est utile pour les tests qui valident le formulaire de login lui-même.
 */
import { type Locator, type Page, expect } from '@playwright/test';

export class AdminLoginPOM {
  constructor(public readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/admin/login');
    await expect(this.emailInput()).toBeVisible();
  }

  emailInput(): Locator {
    return this.page.getByRole('textbox', { name: /email/i });
  }

  passwordInput(): Locator {
    return this.page.getByLabel(/mot de passe/i);
  }

  submitButton(): Locator {
    return this.page.getByRole('button', { name: /se connecter|connexion/i });
  }

  async loginAs(email: string, password: string): Promise<void> {
    await this.emailInput().fill(email);
    await this.passwordInput().fill(password);
    await this.submitButton().click();
    await this.page.waitForURL(/\/admin($|\/)/);
  }
}
