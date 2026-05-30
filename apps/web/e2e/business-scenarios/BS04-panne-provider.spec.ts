/**
 * BS04 — Panne provider primary → fallback Anthropic.
 *
 * Référence : `docs/chat-test-strategy-2026-05/03-business-scenarios/BS04-panne-provider-failover.md`
 *
 * STATUS : tests skip car nécessitent une couche d'injection d'erreur côté
 * provider (route MSW interceptant les calls OpenAI sortants). L'audit C3
 * confirme que les levels 2/3/4 ADR-004 ne sont pas implémentés ; ces tests
 * deviendront actifs après l'implémentation.
 */
import { test, expect } from '@playwright/test';

test.describe('@critical BS04 — Failover provider primary', () => {
  test.skip('OpenAI down → fallback Anthropic transparent (nécessite intercept HTTP)', async () => {
    // Activable une fois Playwright route() configurée pour intercepter
    // les calls OpenAI sortants depuis le serveur Next.js (via proxy ou
    // outbound MSW), ou via API admin pour forcer breaker OPEN sur openai.
  });

  test.skip('tous providers down → mode CANNED_ONLY (futur ADR-004 level 3)', async () => {
    // Bloqué tant que C3 audit pas livré (cf. roadmap chat-audit-2026-05)
  });

  test.skip('admin /admin/chat/health montre serviceLevel dégradé (futur ADR-004)', async () => {
    // Bloqué tant que page /admin/chat/health pas créée
  });
});
