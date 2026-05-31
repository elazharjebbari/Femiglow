/**
 * BS08 — Multilingue handover : FR → AR-MA mid-conversation.
 *
 * STATUS : skip — nécessite intent classifier multi-langue calibré.
 */
import { test } from '@playwright/test';

test.describe('@multilang @critical BS08 — Switch langue mid-conv', () => {
  test.skip('démarrer FR puis switcher en darija — panel passe en RTL', async () => {});
  test.skip('mémoire LLM préserve le contexte malgré switch', async () => {});
});
