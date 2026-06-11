/**
 * BS02 — Frustration FR : 2 messages → lead form auto.
 *
 * Référence : `docs/chat-test-strategy-2026-05/03-business-scenarios/BS02-frustration-lead-auto.md`
 *
 * STATUS : skip pour le moment — dépend de :
 *  - lead-decision règle 4 (frustration consécutive) câblée
 *  - DB seedée avec instruction qui produit réponses vagues
 *  - intent classifier détecte frustration (gap I2 audit)
 */
import { test } from '@playwright/test';
import { ChatWidgetPOM } from '../pom/chat-widget.pom';

test.describe('@critical BS02 — Frustration → lead auto', () => {
  test.skip('2 messages frustrés consécutifs → LeadFormBubble apparaît auto', async ({ page }) => {
    await page.goto('/kit');
    const widget = new ChatWidgetPOM(page);
    await widget.open();

    await widget.sendMessage('Ça ne répond pas à ma question');
    await widget.waitForAssistantReply();

    await widget.sendMessage('Toujours pas !');
    await widget.waitForAssistantReply();

    // LeadFormBubble doit apparaître après 2e message frustré
    // Couvert dès que lead-decision règle 4 livrée
  });
});
