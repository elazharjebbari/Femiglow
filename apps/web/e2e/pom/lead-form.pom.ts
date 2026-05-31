/**
 * Page Object Model — LeadFormBubble.
 *
 * Référence : `docs/chat-test-strategy-2026-05/02-functional-areas/F11-lead-form-bubble/`
 *
 * Utilisable en standalone (form rendu via canned/explicit) ou via
 * `ChatWidgetPOM.leadFormBubble()` (form inline dans la conversation).
 */
import { type Locator, type Page, expect } from '@playwright/test';

export class LeadFormPOM {
  constructor(public readonly page: Page, public readonly root?: Locator) {}

  private container(): Locator {
    return this.root ?? this.page.getByRole('form', { name: /vos coordonnées|بياناتك/i });
  }

  firstNameInput(): Locator {
    return this.container().getByLabel(/prénom|smitek|الاسم/i);
  }

  phoneInput(): Locator {
    return this.container().getByLabel(/téléphone|رقم/i);
  }

  consentCheckbox(): Locator {
    return this.container().getByLabel(/j'accepte|أوافق/i);
  }

  submitButton(): Locator {
    return this.container().getByRole('button', { name: /me rappeler|envoyer|aji|أرسل/i });
  }

  successMessage(): Locator {
    return this.container().getByText(/merci|on vous rappelle|شكرا/i);
  }

  errorMessage(name?: RegExp): Locator {
    return this.container().getByRole('alert', { name });
  }

  async fillAndSubmit(args: {
    firstName: string;
    phone: string;
    consent?: boolean;
  }): Promise<void> {
    await this.firstNameInput().fill(args.firstName);
    await this.phoneInput().fill(args.phone);
    if (args.consent !== false) await this.consentCheckbox().check();
    await this.submitButton().click();
  }

  async expectSuccess(timeoutMs = 5000): Promise<void> {
    await expect(this.successMessage()).toBeVisible({ timeout: timeoutMs });
  }

  async expectSubmitDisabled(): Promise<void> {
    await expect(this.submitButton()).toBeDisabled();
  }

  async expectSubmitEnabled(): Promise<void> {
    await expect(this.submitButton()).toBeEnabled();
  }
}
