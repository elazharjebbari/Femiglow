/**
 * BS03 — Conversion darija : Salam → commande.
 *
 * Référence : `docs/chat-test-strategy-2026-05/03-business-scenarios/BS03-conversion-darija.md`
 *
 * STATUS : tests squelette, skip pour le moment car nécessitent :
 *  - Heuristique darija calibrée (cf. lang/detect.ts)
 *  - Instruction LLM en darija (ar-MA) seedée
 *  - LeadForm copy variant ar-MA validé
 */
import { test, expect } from '@playwright/test';
import { ChatWidgetPOM } from '../pom/chat-widget.pom';

test.describe('@multilang @critical BS03 — Conversion darija', () => {
  test.skip('détection langue darija → réponse arabe RTL', async ({ page }) => {
    await page.goto('/kit');
    const widget = new ChatWidgetPOM(page);
    await widget.open();
    await widget.sendMessage('Salam labas khoya, bshhal had le kit ?');
    await widget.waitForAssistantReply();

    // Panel direction = rtl
    await expect(widget.panel()).toHaveAttribute('dir', 'rtl');
  });

  test.skip('lead form en darija avec placeholder smitek', async () => {});
});
