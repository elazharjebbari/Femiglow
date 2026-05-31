/**
 * Page Object Model — Widget chat visiteur.
 *
 * Référence : `docs/chat-test-strategy-2026-05/01-architecture-test/03-page-objects-pom.md`
 *
 * Couvre :
 *  - Launcher (FAB bouton)
 *  - Panel (ouvert)
 *  - Composer (input)
 *  - MessageList (historique)
 *  - Canned suggestions (pills)
 *  - LeadFormBubble (capture)
 *
 * Owner : Frontend
 * Stable name policy : pas de breaking change sans deprecation.
 */
import { type Page, type Locator, expect } from '@playwright/test';

export class ChatWidgetPOM {
  constructor(public readonly page: Page) {}

  // ─── Locators (lazy, function form) ────────────────────────────────

  launcher(): Locator {
    return this.page.getByRole('button', { name: /ouvrir le chat|افتح المحادثة/i });
  }

  panel(): Locator {
    return this.page.getByRole('region', { name: /assistant femiglow|مساعدة femiglow/i });
  }

  closeButton(): Locator {
    return this.page.getByRole('button', { name: /fermer le chat|أغلق/i });
  }

  composer(): Locator {
    return this.page.getByRole('textbox', { name: /votre message|message|اكتب/i });
  }

  sendButton(): Locator {
    return this.page.getByRole('button', { name: /envoyer|إرسال/i });
  }

  messageList(): Locator {
    return this.page.getByRole('log', { name: /historique|messages|سجل/i });
  }

  cannedSuggestions(): Locator {
    return this.page.getByRole('list', { name: /suggestions|اقتراحات/i });
  }

  cannedPill(label: string | RegExp): Locator {
    return this.cannedSuggestions().getByRole('button', { name: label });
  }

  leadFormBubble(): Locator {
    return this.panel().getByRole('form', { name: /vos coordonnées|بياناتك/i });
  }

  lastAssistantMessage(): Locator {
    return this.messageList()
      .getByRole('listitem')
      .filter({ has: this.page.locator('[data-role="assistant"]') })
      .last();
  }

  lastUserMessage(): Locator {
    return this.messageList()
      .getByRole('listitem')
      .filter({ has: this.page.locator('[data-role="user"]') })
      .last();
  }

  cancelButton(): Locator {
    return this.page.getByRole('button', { name: /annuler|إلغاء/i });
  }

  // ─── Actions composites ────────────────────────────────────────────

  async open(): Promise<void> {
    await this.launcher().click();
    await expect(this.panel()).toBeVisible();
  }

  async close(): Promise<void> {
    await this.closeButton().click();
    await expect(this.panel()).not.toBeVisible();
  }

  async sendMessage(text: string): Promise<void> {
    await this.composer().fill(text);
    await this.sendButton().click();
  }

  async clickCannedPill(label: string | RegExp): Promise<void> {
    await this.cannedPill(label).click();
  }

  /**
   * Attend que la réponse assistant soit complète (SSE end event).
   *
   * Stratégie robuste :
   *  - Attend `data-streaming="false"` sur le panel
   *  - OU attend qu'un dernier `[data-role="assistant"]` soit présent
   *
   * Timeout par défaut 30s — suffisant pour MSW + slow networks.
   */
  async waitForAssistantReply(opts: { timeout?: number } = {}): Promise<void> {
    const timeout = opts.timeout ?? 30_000;
    await this.page.waitForFunction(
      () => {
        const root = document.querySelector('[data-chat-panel]') ?? document.querySelector('[role="region"]');
        if (!root) return false;
        const streaming = root.getAttribute('data-streaming');
        const assistant = root.querySelector('[data-role="assistant"][data-streaming="false"], [data-role="assistant"]:not([data-streaming])');
        return streaming === 'false' && assistant !== null;
      },
      { timeout },
    );
  }

  async fillLeadForm(args: {
    firstName: string;
    phone: string;
    consent?: boolean;
  }): Promise<void> {
    const form = this.leadFormBubble();
    await form.getByLabel(/prénom|smitek|الاسم/i).fill(args.firstName);
    await form.getByLabel(/téléphone|رقم/i).fill(args.phone);
    if (args.consent !== false) {
      await form.getByLabel(/j'accepte|أوافق/i).check();
    }
    await form.getByRole('button', { name: /me rappeler|envoyer|aji|أرسل/i }).click();
  }
}
