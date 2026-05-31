/**
 * BS10 — Tools (futur ADR-002) : visiteur demande statut commande.
 *
 * Référence : `docs/chat-test-strategy-2026-05/03-business-scenarios/BS10-tools-recall-stock.md`
 *
 * STATUS : 100% skip — dépend de C1 (audit) : tools framework totalement
 * absent. Activable une fois `tools[]` + dispatch + `chat_tool_call_log`
 * implémentés.
 */
import { test } from '@playwright/test';

test.describe('@critical BS10 — Tools (FUTUR ADR-002)', () => {
  test.skip('get_order_status → réponse factuelle (futur)', async () => {});
  test.skip('email mismatch → demande clarification (futur)', async () => {});
  test.skip('provider ne support pas tools → mode RAG-only (futur)', async () => {});
});
