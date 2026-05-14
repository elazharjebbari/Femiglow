# Test ULTIMATE — Validation pipeline complète

> **C'est LE test qui fait la différence entre une équipe qui livre et une équipe qui prie.** Un méga-test de bout en bout, durée 30 min, qui valide chaque maillon de la chaîne sous conditions normales ET chaotiques. S'il passe, on dort. S'il échoue, on ne ship pas.

## Philosophie

Le test ULTIMATE n'est pas un agrégat des tests E2E. C'est un test conçu pour **simuler une journée entière de production en 30 minutes** :

- 4 personas qui chattent en parallèle (FR, AR, AR-MA, B2B).
- 12 scénarios canoniques séquencés.
- 5 injections de chaos (provider down, network slow, DB pressure, rate limit, partial stream).
- Vérification finale d'intégrité data + métriques + RGPD + audit logs.
- Aucune intervention humaine.

Si ce test passe, on a la conviction raisonnable que V5 tient en prod. Si **un** détail échoue, on bloque le ship et on enquête.

## Quand l'exécuter

| Trigger | Cadence | Bloquant |
|---|---|---|
| Pre-release (V5 ship) | Une fois par release | OUI ship |
| Pre-merge release branch | À chaque merge dans `release/*` | OUI merge |
| Nightly CI | Tous les soirs à 2h CET | Alerte si fail |
| Manuel sur demande | À la discrétion dev_lead | — |
| Post-incident P0 | Avant de réautoriser le traffic | OUI re-deploy |

## Pré-requis pour exécution

- Base de données PostgreSQL test container PG15+pgvector vierge.
- Seeds chargés (intents + canned + faq + kb).
- MSW server actif avec **tous** les handlers (success + chaos).
- Vercel preview deployment OU local server `npm run start:test`.
- Variables d'env de test (`NODE_ENV=test` + mock secrets).
- Buffer 1h CI runner (timeout sécurité).

## Architecture du test

```
tests/ultimate/
├── ultimate-pipeline.spec.ts       # entry point Playwright
├── personas/
│   ├── soukaina-fr-mobile.ts       # B2C Casablanca mobile darija
│   ├── hicham-b2b-desktop.ts       # B2B hôtel FR desktop
│   ├── naima-marrakech-ar.ts       # B2C Marrakech AR mobile
│   └── youssef-b2c-darija.ts       # B2C jeune darija
├── chapters/
│   ├── 01-greeting-and-discovery.ts
│   ├── 02-canned-then-llm-continuity.ts
│   ├── 03-rag-product-info.ts
│   ├── 04-tool-call-pricing.ts
│   ├── 05-purchase-intent-leadform.ts
│   ├── 06-darija-multilingual.ts
│   ├── 07-language-switch-midconversation.ts
│   ├── 08-frustration-detection.ts
│   ├── 09-mobile-touch-vs-keyboard.ts
│   ├── 10-admin-workflow-suggestion.ts
│   ├── 11-care-receives-hot-lead.ts
│   └── 12-rgpd-export-and-forget.ts
├── chaos/
│   ├── 01-provider-50-down.ts
│   ├── 02-network-slow-2s.ts
│   ├── 03-db-pressure.ts
│   ├── 04-rate-limit-hit.ts
│   └── 05-partial-stream.ts
├── invariants/
│   ├── data-integrity.ts
│   ├── analytics-events.ts
│   ├── rgpd-redaction.ts
│   ├── audit-logs.ts
│   └── budget-tracking.ts
└── fixtures/
    └── seed-ultimate.sql
```

## Le test orchestrateur

```typescript
// tests/ultimate/ultimate-pipeline.spec.ts
import { test, expect } from '@playwright/test';
import { mswServer } from '../mocks/server';
import * as personas from './personas';
import * as chapters from './chapters';
import * as chaos from './chaos';
import * as invariants from './invariants';

test.describe.serial('🏆 ULTIMATE PIPELINE TEST', () => {
  test.setTimeout(40 * 60 * 1000);  // 40 min max

  let startTime: number;
  let testRunId: string;

  test.beforeAll(async () => {
    startTime = Date.now();
    testRunId = `ultimate-${Date.now()}`;
    console.log(`🏁 ULTIMATE start (run id: ${testRunId})`);

    // Reset DB to known state
    await resetDatabase();
    await loadSeedData();

    // MSW ready
    mswServer.resetHandlers();
    mswServer.use(...defaultHappyHandlers);
  });

  test.afterAll(async () => {
    const duration = (Date.now() - startTime) / 1000;
    console.log(`🏆 ULTIMATE done in ${duration.toFixed(1)}s`);

    // Final invariants
    await invariants.dataIntegrity();
    await invariants.analyticsEvents(testRunId);
    await invariants.rgpdRedaction();
    await invariants.auditLogs(testRunId);
    await invariants.budgetTracking();
  });

  // ============================================
  // CHAPITRE 1 — Greeting & Discovery
  // ============================================
  test('Ch 1 — Greeting first visit', async ({ page, browser }) => {
    await chapters.greetingAndDiscovery({
      page,
      browser,
      personas: [personas.soukaina, personas.hicham, personas.naima, personas.youssef],
      testRunId
    });
  });

  // ============================================
  // CHAPITRE 2 — Canned → LLM continuity (job-to-be-done critique)
  // ============================================
  test('Ch 2 — Canned then LLM with continuity note', async ({ page }) => {
    await chapters.cannedThenLLMContinuity({ page, persona: personas.soukaina, testRunId });
  });

  // ============================================
  // CHAPITRE 3 — RAG product info (sources cited)
  // ============================================
  test('Ch 3 — RAG retrieval with sources popover', async ({ page }) => {
    await chapters.ragProductInfo({ page, persona: personas.hicham, testRunId });
  });

  // ============================================
  // CHAPITRE 4 — Tool call (function calling)
  // ============================================
  test('Ch 4 — Tool get_product invoked correctly', async ({ page }) => {
    await chapters.toolCallPricing({ page, persona: personas.soukaina, testRunId });
  });

  // ============================================
  // CHAPITRE 5 — Purchase intent → LeadForm submission
  // ============================================
  test('Ch 5 — LeadForm purchase intent + webhook signed', async ({ page }) => {
    await chapters.purchaseIntentLeadForm({ page, persona: personas.soukaina, testRunId });
  });

  // ============================================
  // CHAOS 1 — Provider 50% down mid-test
  // ============================================
  test('Chaos 1 — Provider 50% down during message', async ({ page }) => {
    await chaos.provider50Down({ mswServer });
    await chapters.cannedThenLLMContinuity({ page, persona: personas.naima, testRunId });
    await chaos.restore({ mswServer });
  });

  // ============================================
  // CHAPITRE 6 — Darija multilingual
  // ============================================
  test('Ch 6 — Darija (AR-MA) full conversation', async ({ page }) => {
    await chapters.darijaMultilingual({ page, persona: personas.youssef, testRunId });
  });

  // ============================================
  // CHAPITRE 7 — Language switch mid-conversation
  // ============================================
  test('Ch 7 — Switch FR → AR mid-conversation', async ({ page }) => {
    await chapters.languageSwitchMidConversation({ page, persona: personas.soukaina, testRunId });
  });

  // ============================================
  // CHAOS 2 — Network slow 2s
  // ============================================
  test('Chaos 2 — Network 2s latency added', async ({ page }) => {
    await chaos.networkSlow({ page, latencyMs: 2000 });
    await chapters.greetingAndDiscovery({ page, browser: null, personas: [personas.hicham], testRunId });
    await chaos.restoreNetwork({ page });
  });

  // ============================================
  // CHAPITRE 8 — Frustration detection
  // ============================================
  test('Ch 8 — Frustration alert fires on repetition', async ({ page }) => {
    await chapters.frustrationDetection({ page, persona: personas.naima, testRunId });
  });

  // ============================================
  // CHAPITRE 9 — Mobile interaction touch vs keyboard
  // ============================================
  test('Ch 9 — Mobile touch interactions (44px hit targets)', async ({ browser }) => {
    await chapters.mobileTouchVsKeyboard({ browser, persona: personas.soukaina, testRunId });
  });

  // ============================================
  // CHAOS 3 — DB pressure (many concurrent sessions)
  // ============================================
  test('Chaos 3 — DB pressure with 50 concurrent sessions', async ({ browser }) => {
    await chaos.dbPressure({ browser, concurrentSessions: 50 });
  });

  // ============================================
  // CHAPITRE 10 — Admin workflow (publish suggestion)
  // ============================================
  test('Ch 10 — Admin publishes new suggestion, visible in chat', async ({ page }) => {
    await chapters.adminWorkflowSuggestion({ page, testRunId });
  });

  // ============================================
  // CHAOS 4 — Rate limit OpenAI
  // ============================================
  test('Chaos 4 — Rate limit hit triggers breaker + fallback', async ({ page }) => {
    await chaos.rateLimitHit({ mswServer });
    await chapters.toolCallPricing({ page, persona: personas.hicham, testRunId });
    await chaos.restore({ mswServer });
  });

  // ============================================
  // CHAPITRE 11 — Care receives hot lead
  // ============================================
  test('Ch 11 — Hot lead reaches care via webhook', async ({ page }) => {
    await chapters.careReceivesHotLead({ page, testRunId });
  });

  // ============================================
  // CHAOS 5 — Partial stream (provider coupe mid-token)
  // ============================================
  test('Chaos 5 — Partial stream graceful error', async ({ page }) => {
    await chaos.partialStream({ mswServer });
    await chapters.cannedThenLLMContinuity({ page, persona: personas.soukaina, testRunId });
    await chaos.restore({ mswServer });
  });

  // ============================================
  // CHAPITRE 12 — RGPD export + forget
  // ============================================
  test('Ch 12 — RGPD export + forget for a persona', async ({ page }) => {
    await chapters.rgpdExportAndForget({ page, persona: personas.naima, testRunId });
  });
});
```

## Détail des chapitres

### Chapitre 1 — Greeting & Discovery

```typescript
// tests/ultimate/chapters/01-greeting-and-discovery.ts
export async function greetingAndDiscovery({ page, browser, personas, testRunId }: Args) {
  for (const persona of personas) {
    const context = browser ? await browser.newContext({ ...persona.device, locale: persona.locale }) : page.context();
    const personaPage = browser ? await context.newPage() : page;

    await personaPage.goto(`/?lang=${persona.lang}&audience=${persona.audience}&__test_run=${testRunId}`);

    // Launcher visible avec pulse
    await expect(personaPage.locator('[data-test=chat-launcher]')).toBeVisible();

    // Click
    await personaPage.click('[data-test=chat-launcher]');

    // Panel monte + greeting cascade
    await expect(personaPage.locator('[data-test=chat-panel]')).toBeVisible({ timeout: 2000 });

    // Greeting localized
    const greeting = await personaPage.locator('[data-test=greeting-message]').textContent();
    expect(greeting).toMatch(persona.expectedGreetingPattern);

    // Suggestions présentes
    await expect(personaPage.locator('[data-test=suggestion-pill]')).toHaveCount(3);

    // RTL si arabe
    if (persona.lang === 'ar') {
      const dir = await personaPage.locator('[data-test=chat-panel]').getAttribute('dir');
      expect(dir).toBe('rtl');
    }

    // Event analytics chat_opened
    await expectAnalyticsEvent({
      sessionId: await getSessionId(personaPage),
      event: 'chat_opened',
      properties: { lang: persona.lang, audience: persona.audience }
    });

    if (browser) await context.close();
  }
}
```

### Chapitre 2 — Canned → LLM Continuity (CRITIQUE)

```typescript
// tests/ultimate/chapters/02-canned-then-llm-continuity.ts
export async function cannedThenLLMContinuity({ page, persona, testRunId }: Args) {
  await page.goto(`/?lang=${persona.lang}&__test_run=${testRunId}`);
  await page.click('[data-test=chat-launcher]');

  // STEP 1 — Clique sur suggestion (canned)
  const firstPill = page.locator('[data-test=suggestion-pill]').first();
  const pillText = await firstPill.textContent();
  await firstPill.click();

  // Vérifier réponse canned (badge visible, pas d'appel provider)
  await expect(page.locator('[data-test=message-canned-badge]').last()).toBeVisible({ timeout: 5000 });

  // Audit : zéro appel à OpenAI pour ce step
  const providerCallsBefore = await getProviderCallCount(testRunId);

  // STEP 2 — User envoie un message LLM en suivant
  await page.fill('[data-test=composer-input]', persona.continuityMessage);
  await page.click('[data-test=composer-send]');

  // Réponse LLM apparaît
  await expect(page.locator('[data-test=message-assistant]').last()).toBeVisible({ timeout: 15000 });

  // VÉRIFICATION CRITIQUE : pas de "Bonjour" en double, pas d'ambiguïté
  const allAssistantTexts = await page.locator('[data-test=message-assistant]').allTextContents();
  const bonjourCount = allAssistantTexts.filter(t => /bonjour|salam|سلام/i.test(t)).length;
  expect(bonjourCount).toBeLessThanOrEqual(1);

  // VÉRIFICATION : la réponse LLM ne ré-explique pas ce qui était dans la canned
  const lastResponse = allAssistantTexts.at(-1)!;
  if (pillText?.includes('prix')) {
    // Si canned était sur prix, LLM doit ne pas répéter le prix verbatim
    expect(lastResponse).not.toContain(pillText);
  }

  // VÉRIFICATION : ephemeral note injectée côté serveur (vérifier via API debug)
  const lastLLMCall = await getLastLLMCall(testRunId);
  expect(lastLLMCall.systemPrompt).toContain('Une suggestion vient d\'être servie');

  // Audit : appel provider compté
  const providerCallsAfter = await getProviderCallCount(testRunId);
  expect(providerCallsAfter).toBeGreaterThan(providerCallsBefore);
}
```

### Chapitre 3 — RAG product info

```typescript
export async function ragProductInfo({ page, persona, testRunId }: Args) {
  await page.goto(`/?lang=${persona.lang}&__test_run=${testRunId}`);
  await page.click('[data-test=chat-launcher]');

  await page.fill('[data-test=composer-input]', persona.ragQuery);
  await page.click('[data-test=composer-send]');

  await expect(page.locator('[data-test=message-assistant]').last()).toBeVisible({ timeout: 15000 });

  // Sources button visible
  await expect(page.locator('[data-test=sources-button]').last()).toBeVisible();

  // Click expand sources
  await page.click('[data-test=sources-button]:last-child');
  await expect(page.locator('[data-test=source-entry]')).toHaveCount(3, { timeout: 3000 });

  // Vérifier événement analytics retrieval_completed
  await expectAnalyticsEvent({
    event: 'retrieval_completed',
    properties: { layer: 'rag', sources_count: 3 }
  });
}
```

### Chapitre 4 — Tool call pricing

```typescript
export async function toolCallPricing({ page, persona, testRunId }: Args) {
  await page.goto(`/?lang=${persona.lang}&__test_run=${testRunId}`);
  await page.click('[data-test=chat-launcher]');

  await page.fill('[data-test=composer-input]', persona.priceQuery);
  await page.click('[data-test=composer-send]');

  // Tool badge apparaît
  await expect(page.locator('[data-test=tool-badge]')).toBeVisible({ timeout: 10000 });
  const toolName = await page.locator('[data-test=tool-badge]').textContent();
  expect(toolName).toContain('get_product');

  // Prix dans la réponse
  const response = await page.locator('[data-test=message-assistant]').last().textContent();
  expect(response).toMatch(/199\s*(dh|MAD)/i);

  // VÉRIFICATION SÉCURITÉ : whitelist Zod, pas de leak
  expect(response).not.toContain('cost');
  expect(response).not.toContain('margin');
  expect(response).not.toContain('supplier');

  // Event analytics tool_call_attempted
  await expectAnalyticsEvent({
    event: 'tool_call_attempted',
    properties: { tool_name: 'get_product', success: true }
  });
}
```

### Chapitre 5 — Purchase intent → LeadForm

```typescript
export async function purchaseIntentLeadForm({ page, persona, testRunId }: Args) {
  await page.goto(`/?lang=${persona.lang}&__test_run=${testRunId}`);
  await page.click('[data-test=chat-launcher]');

  // Conversation jusqu'à intent purchase
  await page.fill('[data-test=composer-input]', persona.purchaseIntentMessage);
  await page.click('[data-test=composer-send]');
  await page.waitForSelector('[data-test=message-assistant]');

  // LeadForm offered inline
  await expect(page.locator('[data-test=lead-form]')).toBeVisible({ timeout: 10000 });

  // Remplir + submit
  await page.fill('[data-test=lead-phone]', persona.phone);
  await page.fill('[data-test=lead-name]', persona.name);
  await page.selectOption('[data-test=lead-city]', persona.city);
  await page.click('[data-test=lead-submit]');

  // Confirmation
  await expect(page.locator('[data-test=lead-success]')).toBeVisible({ timeout: 5000 });

  // VÉRIFICATION SERVER-SIDE :
  // - Lead créé en DB
  const leadInDb = await queryDb<any>(`
    SELECT * FROM chat_leads WHERE phone = $1 AND created_at > NOW() - INTERVAL '1 minute'
  `, [persona.phone]);
  expect(leadInDb.length).toBe(1);

  // - Webhook envoyé avec HMAC signature
  const webhookCalls = await getMockedWebhookCalls();
  const lastWebhook = webhookCalls.at(-1);
  expect(lastWebhook.headers).toHaveProperty('x-signature-v1');
  expect(lastWebhook.body.phone).toBe(persona.phone);

  // - Audit log lead_submitted
  const audit = await queryDb<any>(`
    SELECT * FROM audit_logs WHERE action = 'lead_submitted' AND target LIKE $1 LIMIT 1
  `, [`%${persona.phone}%`]);
  expect(audit.length).toBe(1);

  // Event analytics lead_submitted
  await expectAnalyticsEvent({
    event: 'lead_submitted',
    properties: { intent: 'purchase' }
  });
}
```

### Chapitre 6 — Darija multilingual

```typescript
export async function darijaMultilingual({ page, persona, testRunId }: Args) {
  await page.goto(`/?lang=ar-MA&__test_run=${testRunId}`);
  await page.click('[data-test=chat-launcher]');

  const messages = [
    'Salam, ach kayn 3andkom ?',
    'Wach kayna li7ed Marrakech ?',
    'Bach n3ref chno l-machakil mn 3and l-malka ?'
  ];

  for (const msg of messages) {
    await page.fill('[data-test=composer-input]', msg);
    await page.click('[data-test=composer-send]');
    await page.waitForSelector('[data-test=message-assistant]:last-child', { state: 'attached' });
    await page.waitForFunction(() => !document.querySelector('[data-test=streaming-caret]'), { timeout: 30000 });
  }

  // Vérifier que les 3 réponses sont en darija (heuristique : contient 3,7,9 ou marqueurs darija)
  const responses = await page.locator('[data-test=message-assistant]').allTextContents();
  const darijaResponses = responses.filter(r => /[3579]|wach|kayn|ach|bach|hna|fhamti/i.test(r));
  expect(darijaResponses.length).toBeGreaterThanOrEqual(2);

  // Vérifier intent detection accuracy logs
  const intents = await getIntentDetectionLogs(testRunId);
  expect(intents.filter(i => i.detected_lang === 'ar-MA').length).toBeGreaterThanOrEqual(2);
}
```

### Chapitre 7 — Language switch mid-conversation

```typescript
export async function languageSwitchMidConversation({ page, persona, testRunId }: Args) {
  await page.goto(`/?lang=fr&__test_run=${testRunId}`);
  await page.click('[data-test=chat-launcher]');

  // Premier message FR
  await page.fill('[data-test=composer-input]', 'Bonjour, comment fonctionne le kit ?');
  await page.click('[data-test=composer-send]');
  await page.waitForSelector('[data-test=message-assistant]');

  // Switch vers AR via header
  await page.click('[data-test=language-switch]');
  await page.click('[data-test=lang-option-ar]');

  // RTL appliqué immédiatement
  const dir = await page.locator('[data-test=chat-panel]').getAttribute('dir');
  expect(dir).toBe('rtl');

  // Message historique resté visible (pas effacé)
  await expect(page.locator('[data-test=message-user]')).toBeVisible();

  // Nouveau message en AR
  await page.fill('[data-test=composer-input]', 'هل يمكنني الطلب الآن ؟');
  await page.click('[data-test=composer-send]');
  await page.waitForSelector('[data-test=message-assistant]:last-child');

  // Réponse en AR
  const lastResponse = await page.locator('[data-test=message-assistant]').last().textContent();
  expect(lastResponse).toMatch(/[\u0600-\u06FF]/);  // contient caractères arabes
}
```

### Chapitre 8 — Frustration detection

```typescript
export async function frustrationDetection({ page, persona, testRunId }: Args) {
  await page.goto(`/?lang=${persona.lang}&__test_run=${testRunId}`);
  await page.click('[data-test=chat-launcher]');

  // Envoyer 3 messages frustrés
  const frustrationMessages = [
    'Tu réponds pas à ma question !',
    'Sérieusement, c\'est pas ce que je demande',
    'Bon, j\'abandonne, vous comprenez rien'
  ];

  for (const msg of frustrationMessages) {
    await page.fill('[data-test=composer-input]', msg);
    await page.click('[data-test=composer-send]');
    await page.waitForSelector('[data-test=message-assistant]:last-child');
    await page.waitForTimeout(500);
  }

  // VÉRIFICATION : frustration alert fired vers Care
  const frustrationEvents = await queryDb<any>(`
    SELECT * FROM chat_events 
    WHERE event_name = 'frustration_detected' 
      AND properties->>'test_run_id' = $1
  `, [testRunId]);
  expect(frustrationEvents.length).toBeGreaterThanOrEqual(1);

  // Vérifier Slack webhook care fired (mocké)
  const slackCalls = await getMockedSlackCalls();
  const careAlerts = slackCalls.filter(c => c.channel === '#chat-care');
  expect(careAlerts.length).toBeGreaterThanOrEqual(1);
}
```

### Chapitre 9 — Mobile touch interactions

```typescript
export async function mobileTouchVsKeyboard({ browser, persona, testRunId }: Args) {
  const context = await browser.newContext({
    ...devices['Pixel 5'],
    locale: persona.locale
  });
  const page = await context.newPage();

  await page.goto(`/?lang=${persona.lang}&__test_run=${testRunId}`);

  // Hit target launcher >= 44px
  const launcher = page.locator('[data-test=chat-launcher]');
  const launcherBox = await launcher.boundingBox();
  expect(launcherBox!.width).toBeGreaterThanOrEqual(44);
  expect(launcherBox!.height).toBeGreaterThanOrEqual(44);

  await launcher.tap();
  await expect(page.locator('[data-test=chat-panel]')).toBeVisible();

  // Panel full screen
  const panel = page.locator('[data-test=chat-panel]');
  const viewportSize = page.viewportSize();
  const panelBox = await panel.boundingBox();
  expect(panelBox!.height).toBeGreaterThan(viewportSize!.height * 0.85);

  // Suggestion pills touchables
  const firstPill = page.locator('[data-test=suggestion-pill]').first();
  const pillBox = await firstPill.boundingBox();
  expect(pillBox!.height).toBeGreaterThanOrEqual(44);

  await firstPill.tap();
  await expect(page.locator('[data-test=message-canned-badge]').last()).toBeVisible({ timeout: 5000 });

  await context.close();
}
```

### Chapitre 10 — Admin workflow

```typescript
export async function adminWorkflowSuggestion({ page, testRunId }: Args) {
  await loginAsAdmin(page);
  await page.goto('/admin/suggestions');

  // Créer suggestion
  await page.click('[data-test=suggestions-new]');
  const suggestionKey = `ultimate-test-${testRunId}`;
  await page.fill('[name=key]', suggestionKey);
  await page.fill('[name=label_fr]', 'Suggestion ULTIMATE');
  await page.fill('[name=label_ar]', 'اقتراح');
  await page.fill('[name=label_ar_ma]', 'Suggestion ULTIMATE');
  await page.fill('[name=canned_text_fr]', 'Voici une suggestion automatique pour le test');
  await page.click('[data-test=save-draft]');
  await expect(page.locator('[data-test=status-badge]')).toContainText('Draft');

  // Publish
  await page.click('[data-test=send-to-review]');
  await page.click('[data-test=publish]');
  await expect(page.locator('[data-test=status-badge]')).toContainText('Published');

  // Audit log
  const audit = await queryDb<any>(`
    SELECT * FROM audit_logs 
    WHERE action = 'suggestion_publish' AND target LIKE $1
  `, [`%${suggestionKey}%`]);
  expect(audit.length).toBe(1);

  // Vérifier que la suggestion apparaît en preview chat
  await page.goto('/');
  await page.click('[data-test=chat-launcher]');
  const pillTexts = await page.locator('[data-test=suggestion-pill]').allTextContents();
  expect(pillTexts.some(t => t.includes('Suggestion ULTIMATE'))).toBe(true);
}
```

### Chapitre 11 — Care receives hot lead

```typescript
export async function careReceivesHotLead({ page, testRunId }: Args) {
  // Setup : créer lead HOT (purchase intent + ville majeure)
  await page.goto(`/?__test_run=${testRunId}`);
  await page.click('[data-test=chat-launcher]');

  await page.fill('[data-test=composer-input]', 'Je veux commander maintenant');
  await page.click('[data-test=composer-send]');
  await page.waitForSelector('[data-test=lead-form]');

  const phone = `+212699${Math.floor(100000 + Math.random() * 900000)}`;
  await page.fill('[data-test=lead-phone]', phone);
  await page.fill('[data-test=lead-name]', 'Soukaina ULTIMATE');
  await page.selectOption('[data-test=lead-city]', 'Casablanca');
  await page.click('[data-test=lead-submit]');

  // Lead créé avec priority=hot
  const lead = await queryDb<any>(`
    SELECT * FROM chat_leads WHERE phone = $1
  `, [phone]);
  expect(lead[0].priority).toBe('hot');

  // Care admin voit le lead
  await loginAsAdmin(page);
  await page.goto('/admin/leads?priority=hot');
  await expect(page.locator(`[data-test=lead-row]:has-text("${phone}")`)).toBeVisible({ timeout: 5000 });

  // Webhook fired vers care
  const webhookCalls = await getMockedWebhookCalls();
  const hotLeadCall = webhookCalls.find(c => c.body.phone === phone);
  expect(hotLeadCall).toBeDefined();
  expect(hotLeadCall!.body.priority).toBe('hot');
}
```

### Chapitre 12 — RGPD export + forget

```typescript
export async function rgpdExportAndForget({ page, persona, testRunId }: Args) {
  const targetPhone = `+212690${Math.floor(100000 + Math.random() * 900000)}`;

  // Setup : créer données pour ce persona
  await page.goto(`/?lang=${persona.lang}&__test_run=${testRunId}`);
  await page.click('[data-test=chat-launcher]');
  await page.fill('[data-test=composer-input]', 'Test pour RGPD');
  await page.click('[data-test=composer-send]');
  await page.waitForSelector('[data-test=message-assistant]');

  // Simulate lead submission
  await page.evaluate((phone) => fetch('/api/chat/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, name: 'RGPD Test', city: 'Marrakech', sessionId: 'rgpd-test' })
  }), targetPhone);

  // Admin : export
  await loginAsAdmin(page);
  await page.goto('/admin/rgpd');
  await page.fill('[name=phone]', targetPhone);
  await page.click('[data-test=export]');

  await page.waitForSelector('[data-test=export-result]', { timeout: 10000 });
  const exportText = await page.locator('[data-test=export-result-json]').textContent();
  const exported = JSON.parse(exportText!);

  expect(exported.leads.length).toBeGreaterThanOrEqual(1);
  expect(exported.messages.length).toBeGreaterThanOrEqual(1);
  expect(exported.sessions.length).toBeGreaterThanOrEqual(1);

  // Admin : forget
  await page.click('[data-test=forget]');
  await page.click('[data-test=confirm-forget]');
  await expect(page.locator('[data-test=forget-success]')).toBeVisible();

  // VÉRIFICATION : data anonymisée en DB
  const messagesAfter = await queryDb<any>(`
    SELECT m.* FROM chat_messages m
    JOIN chat_sessions s ON s.id = m.session_id
    JOIN chat_leads l ON l.session_id = s.id
    WHERE l.phone = $1
  `, [targetPhone]);
  expect(messagesAfter.every(m => m.text.startsWith('<REDACTED'))).toBe(true);

  // Lead supprimé
  const leadsAfter = await queryDb<any>(`SELECT * FROM chat_leads WHERE phone = $1`, [targetPhone]);
  expect(leadsAfter.length).toBe(0);

  // Audit log
  const audit = await queryDb<any>(`
    SELECT * FROM audit_logs 
    WHERE action = 'gdpr_forget' AND target LIKE $1
  `, [`%${targetPhone}%`]);
  expect(audit.length).toBe(1);
}
```

## Détail des invariants finaux

### Invariant 1 — Data integrity

```typescript
// tests/ultimate/invariants/data-integrity.ts
export async function dataIntegrity() {
  // Aucun chat_message orphelin (sans session)
  const orphans = await queryDb<any>(`
    SELECT COUNT(*) as count FROM chat_messages m
    LEFT JOIN chat_sessions s ON s.id = m.session_id
    WHERE s.id IS NULL
  `);
  expect(orphans[0].count).toBe('0');

  // Aucun lead orphelin
  const orphanLeads = await queryDb<any>(`
    SELECT COUNT(*) as count FROM chat_leads l
    LEFT JOIN chat_sessions s ON s.id = l.session_id
    WHERE s.id IS NULL
  `);
  expect(orphanLeads[0].count).toBe('0');

  // FK integrity check
  const fkViolations = await queryDb<any>(`
    SELECT conname FROM pg_constraint
    WHERE contype = 'f' AND NOT convalidated
  `);
  expect(fkViolations.length).toBe(0);

  // Aucun tool_call sans réponse persistée
  const toolCallsWithoutResponse = await queryDb<any>(`
    SELECT COUNT(*) as count FROM chat_tool_calls tc
    LEFT JOIN chat_messages m ON m.tool_call_id = tc.id
    WHERE m.id IS NULL AND tc.status = 'success'
  `);
  expect(toolCallsWithoutResponse[0].count).toBe('0');
}
```

### Invariant 2 — Analytics events

```typescript
// tests/ultimate/invariants/analytics-events.ts
export async function analyticsEvents(testRunId: string) {
  // Tous les events du run présents
  const events = await queryDb<any>(`
    SELECT event_name, COUNT(*) as count FROM chat_events
    WHERE properties->>'test_run_id' = $1
    GROUP BY event_name
  `, [testRunId]);

  // Set minimum attendu
  const required = [
    'chat_session_created',
    'chat_opened',
    'message_sent',
    'message_received',
    'intent_detected',
    'retrieval_completed',
    'tool_call_attempted',
    'lead_form_offered',
    'lead_submitted',
    'order_attributed'
  ];

  for (const event of required) {
    const found = events.find(e => e.event_name === event);
    expect(found, `Event ${event} missing`).toBeDefined();
    expect(parseInt(found.count), `Event ${event} count > 0`).toBeGreaterThan(0);
  }

  // Aucun event sans required properties
  const missingProps = await queryDb<any>(`
    SELECT id, event_name FROM chat_events
    WHERE properties->>'test_run_id' = $1
      AND (properties->>'session_id' IS NULL OR properties->>'timestamp' IS NULL)
  `, [testRunId]);
  expect(missingProps.length).toBe(0);
}
```

### Invariant 3 — RGPD redaction

```typescript
// tests/ultimate/invariants/rgpd-redaction.ts
export async function rgpdRedaction() {
  // Aucune PII en clair dans Sentry breadcrumbs simulés
  const breadcrumbs = await getSentryBreadcrumbs();
  for (const bc of breadcrumbs) {
    expect(bc.message, 'Breadcrumb leaks phone').not.toMatch(/\+?\d{8,15}/);
    expect(bc.message, 'Breadcrumb leaks email').not.toMatch(/[\w.-]+@[\w.-]+/);
  }

  // Logs structurés Pino : PII redactée
  const logs = await getPinoLogs();
  for (const log of logs) {
    if (log.lead) {
      expect(log.lead.phone === undefined || log.lead.phone === '<REDACTED>').toBe(true);
    }
  }

  // chat_sessions.ip_redacted toujours sous forme hash, jamais cleartext
  const sessions = await queryDb<any>(`SELECT ip_redacted FROM chat_sessions LIMIT 100`);
  for (const s of sessions) {
    if (s.ip_redacted) {
      expect(s.ip_redacted).toMatch(/^[a-f0-9]{16,}$/);  // hash
    }
  }
}
```

### Invariant 4 — Audit logs

```typescript
// tests/ultimate/invariants/audit-logs.ts
export async function auditLogs(testRunId: string) {
  // Toutes les actions admin sont auditées
  const adminActions = ['suggestion_publish', 'intent_create', 'lead_status_change'];
  for (const action of adminActions) {
    const logs = await queryDb<any>(`
      SELECT COUNT(*) as count FROM audit_logs
      WHERE action = $1 AND created_at > NOW() - INTERVAL '1 hour'
    `, [action]);
    if (parseInt(logs[0].count) > 0) {
      // Si action exécutée, audit log présent avec required fields
      const sample = await queryDb<any>(`
        SELECT * FROM audit_logs WHERE action = $1 LIMIT 1
      `, [action]);
      expect(sample[0].target).toBeDefined();
      expect(sample[0].performed_by).toBeDefined();
      expect(sample[0].performed_at).toBeDefined();
    }
  }

  // RGPD actions auditées
  const rgpdActions = await queryDb<any>(`
    SELECT COUNT(*) as count FROM audit_logs
    WHERE action IN ('gdpr_export', 'gdpr_forget')
      AND created_at > NOW() - INTERVAL '1 hour'
  `);
  // Au moins une RGPD action dans le test
  expect(parseInt(rgpdActions[0].count)).toBeGreaterThanOrEqual(1);
}
```

### Invariant 5 — Budget tracking

```typescript
// tests/ultimate/invariants/budget-tracking.ts
export async function budgetTracking() {
  // Coût LLM total ce test
  const cost = await queryDb<any>(`
    SELECT SUM(llm_cost_usd) as total FROM chat_messages
    WHERE created_at > NOW() - INTERVAL '1 hour'
  `);
  // Test ULTIMATE doit coûter raisonnable (mocks gratuits mais on logs des coûts simulés)
  expect(parseFloat(cost[0].total || '0')).toBeLessThan(1.0);

  // Provider mix : doit y avoir au moins 2 providers dans les call_logs
  const providers = await queryDb<any>(`
    SELECT DISTINCT provider FROM chat_messages
    WHERE created_at > NOW() - INTERVAL '1 hour' AND provider IS NOT NULL
  `);
  expect(providers.length).toBeGreaterThanOrEqual(2);
}
```

## Détail des chaos

### Chaos 1 — Provider 50% down

```typescript
// tests/ultimate/chaos/01-provider-50-down.ts
export async function provider50Down({ mswServer }: ChaosArgs) {
  mswServer.use(
    rest.post('https://api.openai.com/v1/chat/completions', (req, res, ctx) => {
      if (Math.random() < 0.5) {
        return res(ctx.status(503), ctx.json({ error: { message: 'Service unavailable' } }));
      }
      // 50% success
      return res(ctx.status(200), ctx.set('Content-Type', 'text/event-stream'), ctx.body(buildStreamResponse()));
    })
  );
}
```

### Chaos 2 — Network slow

```typescript
// tests/ultimate/chaos/02-network-slow-2s.ts
export async function networkSlow({ page, latencyMs }: ChaosArgs) {
  await page.route('**/*', async (route) => {
    await new Promise(r => setTimeout(r, latencyMs));
    await route.continue();
  });
}

export async function restoreNetwork({ page }: { page: Page }) {
  await page.unroute('**/*');
}
```

### Chaos 3 — DB pressure

```typescript
// tests/ultimate/chaos/03-db-pressure.ts
export async function dbPressure({ browser, concurrentSessions }: ChaosArgs) {
  const contexts = await Promise.all(
    Array.from({ length: concurrentSessions }, () => browser.newContext())
  );

  await Promise.all(contexts.map(async (ctx) => {
    const page = await ctx.newPage();
    await page.goto('/');
    await page.click('[data-test=chat-launcher]');
    await page.fill('[data-test=composer-input]', `Concurrent test ${Date.now()}`);
    await page.click('[data-test=composer-send]');
    await page.waitForSelector('[data-test=message-assistant]', { timeout: 30000 });
  }));

  // Tous doivent réussir, malgré la pression
  await Promise.all(contexts.map(c => c.close()));
}
```

### Chaos 4 — Rate limit hit

```typescript
// tests/ultimate/chaos/04-rate-limit-hit.ts
export async function rateLimitHit({ mswServer }: ChaosArgs) {
  let calls = 0;
  mswServer.use(
    rest.post('https://api.openai.com/*', (req, res, ctx) => {
      calls++;
      if (calls <= 3) {
        return res(ctx.status(429), ctx.set('Retry-After', '60'), ctx.json({
          error: { message: 'Rate limit exceeded', type: 'rate_limit_error' }
        }));
      }
      // Après 3 fails, breaker s'ouvre côté server
      // Le test attend que le système bascule sur Anthropic (qui répond normal)
      return res(ctx.status(200), ctx.json({ /* ... */ }));
    })
  );
}
```

### Chaos 5 — Partial stream

```typescript
// tests/ultimate/chaos/05-partial-stream.ts
export async function partialStream({ mswServer }: ChaosArgs) {
  mswServer.use(
    rest.post('https://api.openai.com/v1/chat/completions', (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.set('Content-Type', 'text/event-stream'),
        // 3 chunks puis silence (timeout client)
        ctx.body(
          'data: {"choices":[{"delta":{"content":"Bon"}}]}\n\n' +
          'data: {"choices":[{"delta":{"content":"jour"}}]}\n\n' +
          'data: {"choices":[{"delta":{"content":" la"}}]}\n\n'
        )
      );
    })
  );
}
```

## Personas

```typescript
// tests/ultimate/personas/soukaina-fr-mobile.ts
export const soukaina = {
  name: 'Soukaina',
  device: devices['Pixel 5'],
  lang: 'fr',
  audience: 'b2c',
  city: 'Casablanca',
  phone: '+212600111222',
  locale: 'fr-FR',
  expectedGreetingPattern: /bonjour|salut/i,
  continuityMessage: 'Et le délai de livraison à Casablanca ?',
  priceQuery: 'Quel est le prix du kit ?',
  purchaseIntentMessage: 'Je voudrais commander le pack maintenant',
  ragQuery: 'Comment fonctionne le kit ?'
};

// tests/ultimate/personas/hicham-b2b-desktop.ts
export const hicham = {
  name: 'Hicham',
  device: devices['Desktop Chrome'],
  lang: 'fr',
  audience: 'b2b',
  city: 'Marrakech',
  phone: '+212611333444',
  locale: 'fr-FR',
  expectedGreetingPattern: /bonjour/i,
  continuityMessage: 'Avez-vous un programme partenaires hôtels ?',
  priceQuery: 'Quels sont vos tarifs B2B ?',
  purchaseIntentMessage: 'Je souhaite signer un partenariat avec mon hôtel',
  ragQuery: 'Quelles options de packaging B2B ?'
};

// tests/ultimate/personas/naima-marrakech-ar.ts
export const naima = {
  name: 'Naima',
  device: devices['iPhone 13'],
  lang: 'ar',
  audience: 'b2c',
  city: 'Marrakech',
  phone: '+212622555666',
  locale: 'ar-MA',
  expectedGreetingPattern: /السلام|أهلا/,
  continuityMessage: 'كم تستغرق التوصيل ؟',
  priceQuery: 'كم سعر الباك ؟',
  purchaseIntentMessage: 'أريد الطلب الآن',
  ragQuery: 'كيف يعمل الباك ؟'
};

// tests/ultimate/personas/youssef-b2c-darija.ts
export const youssef = {
  name: 'Youssef',
  device: devices['Pixel 5'],
  lang: 'ar-MA',
  audience: 'b2c',
  city: 'Rabat',
  phone: '+212633777888',
  locale: 'ar-MA',
  expectedGreetingPattern: /salam|7ya/i,
  continuityMessage: 'Wach kayna li7ed Rabat ?',
  priceQuery: 'B chhal kayswa l-pack ?',
  purchaseIntentMessage: 'Bghit nshri daba',
  ragQuery: 'Kifach kaykhdem l-pack ?'
};
```

## Critères de réussite

Le test ULTIMATE est ✅ **PASS** si :

1. **Tous les chapitres** (12) terminent sans erreur.
2. **Tous les chaos** (5) sont survécus : le système dégrade gracieusement et récupère.
3. **Tous les invariants** (5) finaux passent.
4. **Durée totale** < 40 min (CI timeout 45 min).
5. **Aucun memory leak** détecté (heap snapshot avant/après stable).
6. **Aucun unhandled rejection** dans console browser.
7. **Aucun warning critical Sentry** capturé pendant le run.

Si **un seul** de ces critères échoue → ❌ **FAIL** → ship bloqué.

## Reporting

À la fin du test, un rapport HTML est généré :

```
test-results/ultimate-{date}/
├── report.html              # vue d'ensemble
├── chapters/
│   ├── ch01-greeting.html   # détail par chapitre + screenshots
│   └── ...
├── chaos/
│   └── ...
├── invariants.json
├── timings.csv              # durée par étape
├── network.har              # toutes requêtes capturées
└── coverage.lcov            # coverage du test
```

## Exécution

```bash
# Local (besoin: Postgres test container + .env.test)
npm run test:ultimate

# CI nightly
# Configuré dans .github/workflows/ultimate.yml avec schedule: '0 2 * * *'

# Manuel sur staging (Vercel preview)
PLAYWRIGHT_BASE_URL=https://staging.femiglow.com npm run test:ultimate
```

## Iterations futures (V6+, V7+)

V6 ajoutera :
- Chapitre A/B testing exposure tracking validation.
- Chapitre B2B advanced lead form fields.
- Chapitre dark mode toggle (V7).

V7 ajoutera :
- Chapitre Sendit tracking integration (mock).
- Chapitre promo engine + check_promo tool.
- Chaos 6 — Sendit API timeout.

## Anti-patterns ULTIMATE

- ❌ Désactiver un chapitre "temporairement" car flaky : on fixe la cause, on ne masque pas.
- ❌ Skip un invariant car "il échoue mais c'est pas grave" : c'est toujours grave.
- ❌ Lancer ULTIMATE sans seed déterministe : résultats irreproductibles.
- ❌ Lancer ULTIMATE en parallèle de tests E2E sur même DB : conflit data.
- ❌ Considérer ULTIMATE comme remplacement des unit/integration : il complète, ne remplace pas.
- ❌ Lancer ULTIMATE en prod sans préfixer toutes les données avec `__test_run` (pollution).
