/**
 * BS09 — Budget mensuel exhausted : fallback CANNED_ONLY (FUTUR ADR-004 level 3).
 *
 * Référence : `docs/chat-test-strategy-2026-05/03-business-scenarios/BS09-budget-exhausted.md`
 *
 * STATUS : 100% skip — dépend de l'implémentation de :
 *   - C4 (audit) : `assertBudget` câblé runtime (cf. audit-regressions.test.ts)
 *   - C3 (audit) : level 3 CANNED_ONLY (cf. F35-budget-guard plan)
 */
import { test } from '@playwright/test';

test.describe('@critical BS09 — Budget exhausted (FUTUR)', () => {
  test.skip('visiteur en CANNED_ONLY voit FAQ scripted sans LLM (futur)', async () => {});
  test.skip('admin /admin/chat/health montre service_level=3 (futur)', async () => {});
  test.skip('event chat_budget_exhausted incrémenté (futur)', async () => {});
});
