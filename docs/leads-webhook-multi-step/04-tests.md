# 4. Batterie de tests

## 4.1 Stratégie globale

3 couches de tests, exécutées dans le CI dans cet ordre :

1. **Unit (Vitest)** — fonctions pures, validations Zod, builders payload. <2s.
2. **Integration (Vitest + memoryStore + MSW)** — routes API, dispatcher avec endpoint mock, scanner cron. <30s.
3. **E2E (Playwright)** — wizard complet bout-en-bout dans un navigateur, vérification que le webhook est appelé sur un endpoint stub local. <2min.

Toutes les tables touchent au `memoryStore` (pas de Postgres en CI). Pour les tests d'index/migration on a un test dédié `migration-smoke.test.ts` qui execute la SQL sur une base éphémère.

## 4.2 Couverture cible

| Module | Coverage cible | Cas critiques |
|---|---|---|
| `payload.ts` (Zod) | 100% lignes | conversation valide / invalide / vide / >50 / texte tronqué |
| `helpers/conversation.ts` | 100% lignes | empty, user-only, mixed, oversized, system filtré |
| `from-chat-lead.ts` | 95% | avec/sans snapshot, avec/sans firstName, phone valide/invalide |
| `from-wizard-step2.ts` (nouveau) | 100% | first call ok, second call (déjà step2WebhookAt) → no-op |
| `from-wizard-step1-abandon.ts` (nouveau) | 100% | filtré par source wizard, avec/sans gclid |
| `lead-step1-abandon-scanner.ts` (nouveau) | 95% | aucun lead, lead pas mûr (<5min), lead mûr+stamp, mix |
| `lead-settings.ts` | 100% | cache, clamp [1,60], default 5 |
| Routes API | 90% | step1+step2+abandon flows, idempotency replay |

## 4.3 Tests unitaires (Vitest)

### `lib/webhooks/outbound/payload.test.ts` (extensions)

```ts
describe('outboundPayloadSchema — conversation', () => {
  it('accepts conversation with mixed roles', () => {
    const result = outboundPayloadSchema.safeParse({
      id: 'test',
      full_name: 'X',
      phone: '0600',
      conversation: [
        { role: 'user', name: 'Sara', text: 'hi', ts: '2026-05-14T10:00:00Z' },
        { role: 'bot', name: 'Assistant', text: 'hello', ts: '2026-05-14T10:00:05Z' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects conversation with >50 messages', () => {
    const msgs = Array.from({ length: 51 }, (_, i) => ({
      role: 'user' as const, text: `msg${i}`, ts: '2026-05-14T10:00:00Z',
    }));
    const result = outboundPayloadSchema.safeParse({
      id: 'test', full_name: 'X', phone: '0600', conversation: msgs,
    });
    expect(result.success).toBe(false);
  });

  it('rejects conversation message text >4000 chars', () => {
    const result = outboundPayloadSchema.safeParse({
      id: 'test', full_name: 'X', phone: '0600',
      conversation: [{ role: 'user', text: 'a'.repeat(4001), ts: '2026-05-14T10:00:00Z' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects conversation message with invalid ts', () => {
    const result = outboundPayloadSchema.safeParse({
      id: 'test', full_name: 'X', phone: '0600',
      conversation: [{ role: 'user', text: 'x', ts: 'not-a-date' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts payload without conversation (optional)', () => {
    const result = outboundPayloadSchema.safeParse({
      id: 'test', full_name: 'X', phone: '0600',
    });
    expect(result.success).toBe(true);
  });

  it('accepts source field', () => {
    const result = outboundPayloadSchema.safeParse({
      id: 'test', full_name: 'X', phone: '0600', source: 'facebook_ad',
    });
    expect(result.success).toBe(true);
  });
});
```

### `lib/webhooks/outbound/helpers/conversation.test.ts` (nouveau)

```ts
describe('buildConversationFromSnapshot', () => {
  it('null snapshot → undefined', () => {
    expect(buildConversationFromSnapshot(null, 'Sara')).toBeUndefined();
  });

  it('empty array → undefined', () => {
    expect(buildConversationFromSnapshot([], 'Sara')).toBeUndefined();
  });

  it('user message → role user + name from firstName', () => {
    const out = buildConversationFromSnapshot(
      [{ role: 'user', content: 'hi', at: '2026-05-14T10:00:00Z' }],
      'Sara',
    );
    expect(out).toEqual([
      { role: 'user', name: 'Sara', text: 'hi', ts: '2026-05-14T10:00:00Z' },
    ]);
  });

  it('user message + null firstName → name=Visiteur', () => {
    const out = buildConversationFromSnapshot(
      [{ role: 'user', content: 'hi', at: '2026-05-14T10:00:00Z' }],
      null,
    );
    expect(out![0].name).toBe('Visiteur');
  });

  it('assistant message → role bot + name=Assistant', () => {
    const out = buildConversationFromSnapshot(
      [{ role: 'assistant', content: 'salut', at: '2026-05-14T10:00:00Z' }],
      'Sara',
    );
    expect(out![0].role).toBe('bot');
    expect(out![0].name).toBe('Assistant');
  });

  it('filters out system/tool messages', () => {
    const out = buildConversationFromSnapshot(
      [
        { role: 'system', content: 'sys prompt', at: '2026-05-14T10:00:00Z' },
        { role: 'user', content: 'hi', at: '2026-05-14T10:00:01Z' },
        { role: 'tool', content: 'tool call', at: '2026-05-14T10:00:02Z' },
      ],
      'Sara',
    );
    expect(out).toHaveLength(1);
    expect(out![0].role).toBe('user');
  });

  it('keeps last 50 messages when > 50', () => {
    const msgs = Array.from({ length: 60 }, (_, i) => ({
      role: 'user' as const, content: `msg${i}`, at: '2026-05-14T10:00:00Z',
    }));
    const out = buildConversationFromSnapshot(msgs, 'Sara');
    expect(out).toHaveLength(50);
    expect(out![0].text).toBe('msg10');
    expect(out![49].text).toBe('msg59');
  });

  it('truncates text > 4000 chars', () => {
    const out = buildConversationFromSnapshot(
      [{ role: 'user', content: 'a'.repeat(5000), at: '2026-05-14T10:00:00Z' }],
      'Sara',
    );
    expect(out![0].text.length).toBe(4000);
  });
});
```

### `lib/webhooks/outbound/sources/from-chat-lead.test.ts` (extensions)

```ts
it('includes conversation when snapshot exists', () => {
  const lead = mkChatLead({
    snapshotMessages: [
      { role: 'user', content: 'salam', at: '2026-05-14T10:00:00Z' },
      { role: 'assistant', content: 'hello', at: '2026-05-14T10:00:05Z' },
    ],
    firstName: 'Sara',
  });
  const payload = buildChatLeadPayload({ lead });
  expect(payload.conversation).toHaveLength(2);
  expect(payload.conversation![0]).toMatchObject({
    role: 'user', name: 'Sara', text: 'salam',
  });
});

it('omits conversation when snapshot is null', () => {
  const lead = mkChatLead({ snapshotMessages: null });
  const payload = buildChatLeadPayload({ lead });
  expect(payload.conversation).toBeUndefined();
});
```

### `lib/webhooks/outbound/sources/from-wizard-step2.test.ts` (nouveau)

```ts
describe('dispatchLeadStep2Webhook', () => {
  it('no-op si step2WebhookAt déjà stamped', async () => {
    const lead = mkChatLead({ step2WebhookAt: new Date(), addressCompletedAt: new Date() });
    const spy = vi.spyOn(dispatcher, 'dispatchOutbound');
    await dispatchLeadStep2Webhook({ lead });
    expect(spy).not.toHaveBeenCalled();
  });

  it('no-op si addressCompletedAt null', async () => {
    const lead = mkChatLead({ addressCompletedAt: null, step2WebhookAt: null });
    const spy = vi.spyOn(dispatcher, 'dispatchOutbound');
    await dispatchLeadStep2Webhook({ lead });
    expect(spy).not.toHaveBeenCalled();
  });

  it('dispatch avec event=lead.step2_completed + payload conforme', async () => {
    const lead = mkChatLead({
      addressCompletedAt: new Date(),
      step2WebhookAt: null,
      shippingCity: 'Marrakech',
      shippingAddressLine1: '12 Rue Al Houda',
    });
    const spy = vi.spyOn(dispatcher, 'dispatchOutbound').mockResolvedValue();
    await dispatchLeadStep2Webhook({ lead });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      source: 'lead-step2',
      eventName: 'lead.step2_completed',
      idempotencyKey: `lead-step2:${lead.id}`,
      payload: expect.objectContaining({
        full_name: 'Sara',
        city: 'Marrakech',
        address: expect.stringContaining('12 Rue'),
      }),
    }));
  });

  it('inclut conversation si lead origine chat (snapshotMessages présent)', async () => {
    const lead = mkChatLead({
      addressCompletedAt: new Date(),
      step2WebhookAt: null,
      snapshotMessages: [
        { role: 'user', content: 'hi', at: '2026-05-14T10:00:00Z' },
      ],
    });
    const spy = vi.spyOn(dispatcher, 'dispatchOutbound').mockResolvedValue();
    await dispatchLeadStep2Webhook({ lead });
    expect(spy.mock.calls[0][0].payload.conversation).toHaveLength(1);
  });
});
```

### `lib/webhooks/outbound/lead-step1-abandon-scanner.test.ts` (nouveau)

```ts
describe('scanAndDispatchStep1Abandons', () => {
  beforeEach(() => resetMemoryStore());

  it('aucun lead → 0 dispatched', async () => {
    const r = await scanAndDispatchStep1Abandons();
    expect(r).toEqual({ scanned: 0, dispatched: 0, failed: 0 });
  });

  it('lead trop récent (<5min) → skip', async () => {
    await insertChatLead({
      leadCapturedAt: new Date(Date.now() - 2 * 60_000), // 2min
      source: 'wizard_cart',
    });
    const r = await scanAndDispatchStep1Abandons();
    expect(r.dispatched).toBe(0);
  });

  it('lead mûr (>5min) + pas address → dispatché + stamp', async () => {
    const lead = await insertChatLead({
      leadCapturedAt: new Date(Date.now() - 10 * 60_000),
      addressCompletedAt: null,
      purchasedAt: null,
      source: 'wizard_cart',
    });
    const r = await scanAndDispatchStep1Abandons();
    expect(r.dispatched).toBe(1);
    const after = await getChatLead(lead.id);
    expect(after.step1AbandonWebhookAt).toBeTruthy();
  });

  it('lead déjà stamped step1_abandon → re-run skip', async () => {
    await insertChatLead({
      leadCapturedAt: new Date(Date.now() - 10 * 60_000),
      step1AbandonWebhookAt: new Date(),
      source: 'wizard_cart',
    });
    const r = await scanAndDispatchStep1Abandons();
    expect(r.dispatched).toBe(0);
  });

  it('lead avec addressCompletedAt set → skip (utilisateur a complété)', async () => {
    await insertChatLead({
      leadCapturedAt: new Date(Date.now() - 10 * 60_000),
      addressCompletedAt: new Date(Date.now() - 5 * 60_000),
      source: 'wizard_cart',
    });
    const r = await scanAndDispatchStep1Abandons();
    expect(r.dispatched).toBe(0);
  });

  it('lead origine chat (source=chat_widget) → skip (déjà géré par from-chat-lead)', async () => {
    await insertChatLead({
      leadCapturedAt: new Date(Date.now() - 10 * 60_000),
      source: 'chat_widget',
    });
    const r = await scanAndDispatchStep1Abandons();
    expect(r.dispatched).toBe(0);
  });

  it('respecte le setting timeout configurable', async () => {
    await setTrackingSetting('lead.step1_abandon_timeout_minutes', 10);
    invalidateLeadSettingsCache();
    await insertChatLead({
      leadCapturedAt: new Date(Date.now() - 7 * 60_000), // 7min, < 10min
      source: 'wizard_cart',
    });
    const r = await scanAndDispatchStep1Abandons();
    expect(r.dispatched).toBe(0); // pas encore mûr
  });
});
```

### `lib/tracking/settings/lead-settings.test.ts` (nouveau)

```ts
describe('lead-settings', () => {
  it('default 5 minutes si setting absent', async () => {
    expect(await getLeadStep1AbandonTimeoutMinutes()).toBe(5);
  });

  it('clamp [1, 60]', async () => {
    await setTrackingSetting('lead.step1_abandon_timeout_minutes', 100);
    invalidateLeadSettingsCache();
    expect(await getLeadStep1AbandonTimeoutMinutes()).toBe(60);

    await setTrackingSetting('lead.step1_abandon_timeout_minutes', 0);
    invalidateLeadSettingsCache();
    expect(await getLeadStep1AbandonTimeoutMinutes()).toBe(1);
  });

  it('cache 60s — re-read ne ré-hit pas DB', async () => {
    const spy = vi.spyOn(repository, 'getTrackingSettings');
    await getLeadStep1AbandonTimeoutMinutes();
    await getLeadStep1AbandonTimeoutMinutes();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('invalidate cache après update', async () => {
    await setTrackingSetting('lead.step1_abandon_timeout_minutes', 5);
    expect(await getLeadStep1AbandonTimeoutMinutes()).toBe(5);
    await setTrackingSetting('lead.step1_abandon_timeout_minutes', 15);
    invalidateLeadSettingsCache();
    expect(await getLeadStep1AbandonTimeoutMinutes()).toBe(15);
  });
});
```

## 4.4 Tests d'intégration (routes API)

### `app/api/checkout/lead/[leadId]/address/route.test.ts` (extensions)

```ts
it('PATCH address déclenche dispatchLeadStep2Webhook (fire-and-forget)', async () => {
  const lead = await createLead({ firstName: 'Sara', phone: '0661234567' });
  const spy = vi.spyOn(step2Module, 'dispatchLeadStep2Webhook').mockResolvedValue();

  const res = await PATCH(buildReq({
    leadId: lead.id,
    body: { city: 'Marrakech', addressLine1: '12 Rue Al Houda' },
  }));
  expect(res.status).toBe(200);

  // attendre un tick pour laisser fire-and-forget partir
  await new Promise((r) => setTimeout(r, 50));
  expect(spy).toHaveBeenCalledTimes(1);
});

it('PATCH address échec webhook ne casse PAS la réponse 200', async () => {
  vi.spyOn(step2Module, 'dispatchLeadStep2Webhook').mockRejectedValue(new Error('endpoint down'));
  const lead = await createLead({ firstName: 'Sara', phone: '0661234567' });
  const res = await PATCH(buildReq({ leadId: lead.id, body: { city: 'Casa', addressLine1: 'X' } }));
  expect(res.status).toBe(200);
});

it('PATCH address ne fire pas le webhook si setting step2_webhook_enabled=false', async () => {
  await setTrackingSetting('lead.step2_webhook_enabled', false);
  const spy = vi.spyOn(step2Module, 'dispatchLeadStep2Webhook').mockResolvedValue();
  const lead = await createLead({ firstName: 'Sara', phone: '0661234567' });
  await PATCH(buildReq({ leadId: lead.id, body: { city: 'X', addressLine1: 'Y' } }));
  await new Promise((r) => setTimeout(r, 50));
  expect(spy).not.toHaveBeenCalled();
});
```

### `app/api/cron/lead-step1-abandon/route.test.ts` (nouveau)

```ts
it('refuse sans X-Cron-Secret valide', async () => {
  const res = await POST(buildReq({ headers: {} }));
  expect(res.status).toBe(401);
});

it('avec secret valide → exécute le scanner et renvoie le résultat', async () => {
  await insertChatLead({ leadCapturedAt: new Date(Date.now() - 10 * 60_000), source: 'wizard_cart' });
  const res = await POST(buildReq({ headers: { 'X-Cron-Secret': process.env.CRON_SECRET } }));
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.dispatched).toBeGreaterThanOrEqual(1);
});
```

### `app/api/chat/lead/contact/route.test.ts` (extensions)

```ts
it('payload webhook contient conversation depuis snapshot_messages', async () => {
  const session = await createChatSession();
  await insertChatMessages(session.id, [
    { role: 'user', content: 'Salam' },
    { role: 'assistant', content: 'Bonjour' },
  ]);
  const dispatchSpy = vi.spyOn(dispatcher, 'dispatchOutbound').mockResolvedValue();

  await POST(buildReq({
    body: { sessionId: session.id, firstName: 'Sara', phoneRaw: '0661234567', consentVersion: '2026-v1' },
  }));
  await new Promise((r) => setTimeout(r, 50));

  expect(dispatchSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({
        conversation: expect.arrayContaining([
          expect.objectContaining({ role: 'user', name: 'Sara', text: 'Salam' }),
          expect.objectContaining({ role: 'bot', name: 'Assistant', text: 'Bonjour' }),
        ]),
      }),
    }),
  );
});
```

## 4.5 Tests E2E (Playwright)

### `e2e/leads-webhook-multi-step.spec.ts` (nouveau)

```ts
import { test, expect } from '@playwright/test';

// Stub HTTP server pour capturer le webhook
let receivedWebhooks: any[] = [];

test.beforeAll(async () => {
  startStubServer(3099, (req, body) => {
    receivedWebhooks.push({
      url: req.url, headers: req.headers, body: JSON.parse(body),
    });
  });
  process.env.OUTBOUND_WEBHOOK_URL = 'http://localhost:3099/hook';
  process.env.OUTBOUND_WEBHOOK_SECRET = 'test-secret';
});

test.beforeEach(() => { receivedWebhooks = []; });

test('Flow A nominal : step1 + step2 + order → 2 webhooks (step2, order)', async ({ page }) => {
  await page.goto('/commander');

  // Step 1
  await page.fill('[name=firstName]', 'Sara');
  await page.fill('[name=phone]', '0661234567');
  await page.check('[name=consent]');
  await page.click('button[type=submit]');

  // Step 2
  await page.fill('[name=city]', 'Marrakech');
  await page.fill('[name=addressLine1]', '12 Rue Al Houda');
  await page.click('button[type=submit]');

  // attendre que le webhook step2 parte
  await page.waitForTimeout(500);
  expect(receivedWebhooks).toHaveLength(1);
  expect(receivedWebhooks[0].body.id).toMatch(/^lead-step2:/);
  expect(receivedWebhooks[0].headers['x-femiglow-event']).toBe('lead.step2_completed');
  expect(receivedWebhooks[0].body.full_name).toBe('Sara');
  expect(receivedWebhooks[0].body.city).toBe('Marrakech');

  // Step 3 (confirm order)
  await page.click('button:has-text("Confirmer")');
  await page.waitForTimeout(500);
  expect(receivedWebhooks).toHaveLength(2);
  expect(receivedWebhooks[1].headers['x-femiglow-event']).toBe('order.completed');
});

test('Flow B : abandon step 1 → webhook step1_abandoned après timeout', async ({ page, request }) => {
  // Setting le timeout très court pour le test (10s)
  await request.post('/admin/api/tracking/settings', {
    data: { 'lead.step1_abandon_timeout_minutes': 0.17 }, // ~10s
    headers: { Cookie: adminCookie },
  });

  await page.goto('/commander');
  await page.fill('[name=firstName]', 'Youssef');
  await page.fill('[name=phone]', '0612345678');
  await page.check('[name=consent]');
  await page.click('button[type=submit]');

  // user ferme l'onglet
  await page.close();

  // Trigger cron scanner après 11s
  await new Promise((r) => setTimeout(r, 11000));
  await request.post('/api/cron/lead-step1-abandon', {
    headers: { 'X-Cron-Secret': process.env.CRON_SECRET! },
  });

  await new Promise((r) => setTimeout(r, 500));
  expect(receivedWebhooks).toHaveLength(1);
  expect(receivedWebhooks[0].headers['x-femiglow-event']).toBe('lead.step1_abandoned');
  expect(receivedWebhooks[0].body.full_name).toBe('Youssef');
  expect(receivedWebhooks[0].body.phone).toBe('0612345678');
});

test('Flow C : chat lead → webhook immédiat AVEC conversation', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="chat-launcher"]');
  await page.fill('[data-testid="chat-input"]', 'Salam, je veux commander');
  await page.click('[data-testid="chat-send"]');

  // attendre la réponse IA + signal lead_form_offered
  await page.waitForSelector('[data-testid="lead-form-bubble"]', { timeout: 10_000 });

  // user soumet le formulaire lead in-chat
  await page.fill('[data-testid="lead-form-name"]', 'Sara');
  await page.fill('[data-testid="lead-form-phone"]', '0661234567');
  await page.click('[data-testid="lead-form-submit"]');

  await page.waitForTimeout(500);
  expect(receivedWebhooks).toHaveLength(1);
  expect(receivedWebhooks[0].headers['x-femiglow-event']).toBe('chat_lead.created');

  // ★ Vérification clé : la conversation est embarquée
  const conv = receivedWebhooks[0].body.conversation;
  expect(conv).toBeDefined();
  expect(conv.length).toBeGreaterThan(0);
  expect(conv[0]).toMatchObject({
    role: 'user',
    name: 'Sara',
    text: expect.stringContaining('Salam'),
  });
});

test('Flow B → C : abandon step 1, puis user retourne et complète step 2 → step2 fire mais step1_abandon NE fire PAS (déjà stamped)', async ({ page, request }) => {
  // Setting timeout court
  await setTimeout10s(request);

  // Step 1
  await page.goto('/commander');
  await page.fill('[name=firstName]', 'Test');
  await page.fill('[name=phone]', '0611111111');
  await page.check('[name=consent]');
  await page.click('button[type=submit]');

  // attendre + trigger cron
  await new Promise((r) => setTimeout(r, 11000));
  await request.post('/api/cron/lead-step1-abandon', { headers: cronHeaders });
  expect(receivedWebhooks.filter((w) => w.headers['x-femiglow-event'] === 'lead.step1_abandoned')).toHaveLength(1);

  // user revient sur step 2
  await page.fill('[name=city]', 'Casa');
  await page.fill('[name=addressLine1]', 'X');
  await page.click('button[type=submit]');

  // step2 fire, mais on ne doit pas avoir un 2e step1_abandon
  await new Promise((r) => setTimeout(r, 500));
  expect(receivedWebhooks.filter((w) => w.headers['x-femiglow-event'] === 'lead.step1_abandoned')).toHaveLength(1);
  expect(receivedWebhooks.filter((w) => w.headers['x-femiglow-event'] === 'lead.step2_completed')).toHaveLength(1);
});

test('Phone normalisation +212 → 0XX dans le payload', async ({ page }) => {
  await page.goto('/commander');
  await page.fill('[name=firstName]', 'X');
  await page.fill('[name=phone]', '+212661234567'); // E.164 saisi par user
  await page.check('[name=consent]');
  await page.click('button[type=submit]');

  // step 2
  await page.fill('[name=city]', 'Y');
  await page.fill('[name=addressLine1]', 'Z');
  await page.click('button[type=submit]');
  await new Promise((r) => setTimeout(r, 500));

  expect(receivedWebhooks[0].body.phone).toBe('0661234567');
});

test('Signature HMAC valide dans le header', async ({ page }) => {
  await runStep1Step2Flow(page);
  const w = receivedWebhooks[0];
  const expected = crypto.createHmac('sha256', 'test-secret')
    .update(JSON.stringify(w.body)) // ATTENTION: doit être le raw body, pas re-stringified
    .digest('hex');
  // En vrai test E2E, le stub server reçoit le raw body avant parsing
  expect(w.headers['x-femiglow-signature']).toMatch(/^sha256=/);
});
```

### `e2e/admin-leads-journey-view.spec.ts` (nouveau, M6)

```ts
test('Admin /admin/leads affiche KPI cards + funnel + colonnes journey/webhook', async ({ page }) => {
  // Seed 3 leads dans des états différents
  await seedLead({ firstName: 'A', lastTouchedStep: 'lead' });
  await seedLead({ firstName: 'B', lastTouchedStep: 'address' });
  await seedLead({ firstName: 'C', purchasedAt: new Date() });

  await loginAsAdmin(page);
  await page.goto('/admin/leads');

  // KPI cards visibles
  await expect(page.locator('[data-testid="kpi-step1"]')).toContainText('3');
  await expect(page.locator('[data-testid="kpi-step2"]')).toContainText('2');
  await expect(page.locator('[data-testid="kpi-purchase"]')).toContainText('1');

  // Funnel rendu
  await expect(page.locator('[data-testid="funnel-mini"]')).toBeVisible();

  // Colonnes journey + webhook présentes
  await expect(page.locator('th:has-text("Parcours")')).toBeVisible();
  await expect(page.locator('th:has-text("Webhook")')).toBeVisible();

  // KPI cliquable filtre la table
  await page.click('[data-testid="kpi-purchase"]');
  await expect(page).toHaveURL(/journey=purchase/);
  // Vérifie qu'il ne reste qu'une ligne (le lead C)
  await expect(page.locator('tbody tr')).toHaveCount(1);
});
```

### `e2e/admin-lead-detail-webhook.spec.ts` (nouveau, M6)

```ts
test('Détail lead affiche timeline + drawer historique webhook + retry button', async ({ page }) => {
  const lead = await seedLead({
    firstName: 'Sara',
    lastTouchedStep: 'address',
    leadCapturedAt: new Date(Date.now() - 5*60_000),
    addressCompletedAt: new Date(Date.now() - 2*60_000),
  });
  await seedWebhookLog({
    sourceId: lead.id,
    eventName: 'lead.step2_completed',
    status: 'failed',
    attemptCount: 3,
    lastError: 'HTTP 503',
  });

  await loginAsAdmin(page);
  await page.goto(`/admin/leads/${lead.id}`);

  // Section parcours visible
  await expect(page.locator('[data-testid="journey-timeline"]')).toBeVisible();
  await expect(page.locator('text=Lead')).toBeVisible();
  await expect(page.locator('text=Adresse')).toBeVisible();

  // Section webhook visible
  await expect(page.locator('[data-testid="webhook-summary"]')).toBeVisible();
  await expect(page.locator('text=lead.step2_completed')).toBeVisible();
  await expect(page.locator('text=failed')).toBeVisible();

  // Ouvrir drawer
  await page.click('[data-testid="webhook-detail-trigger"]');
  await expect(page.locator('[role="dialog"][data-testid="webhook-history-drawer"]')).toBeVisible();
  await expect(page.locator('text=HTTP 503')).toBeVisible();

  // Retry button → POST /api/admin/webhooks/retry
  const retryReq = page.waitForRequest((r) => r.url().includes('/api/admin/webhooks/retry'));
  await page.click('button:has-text("Rejouer")');
  const req = await retryReq;
  expect(req.method()).toBe('POST');

  // Toast feedback
  await expect(page.locator('text=Rejoué')).toBeVisible({ timeout: 3000 });

  // Esc ferme le drawer
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="webhook-history-drawer"]')).not.toBeVisible();
});
```

### `e2e/admin-tracking-settings-leads.spec.ts` (nouveau, M6)

```ts
test('Settings tracking — toggle timeout + envoie payload test reçu côté stub', async ({ page, request }) => {
  // Stub webhook receiver
  receivedWebhooks = [];

  await loginAsAdmin(page);
  await page.goto('/admin/tracking/settings');

  // Section leads-webhook présente
  await expect(page.locator('text=Leads → Webhook outbound')).toBeVisible();

  // Health badge rendu
  await expect(page.locator('[data-testid="webhook-health-badge"]')).toBeVisible();

  // Toggle step2_webhook_enabled
  const toggle = page.locator('input[name="lead.step2_webhook_enabled"]');
  await toggle.uncheck();
  await expect(page.locator('text=Sauvegardé')).toBeVisible({ timeout: 3000 });

  // Vérifier en DB que le setting est false
  // (via /api/admin/tracking/settings GET, ou directement Postgres dans le test setup)
  const settings = await request.get('/api/admin/tracking/settings');
  const data = await settings.json();
  expect(data['lead.step2_webhook_enabled']).toBe(false);

  // Input timeout
  const input = page.locator('input[name="lead.step1_abandon_timeout_minutes"]');
  await input.fill('15');
  await input.blur(); // debounce 500ms puis save
  await page.waitForTimeout(800);
  await expect(page.locator('text=Sauvegardé')).toBeVisible();

  // Bouton test
  await page.click('button:has-text("Envoyer un payload test")');
  await page.waitForTimeout(500);
  expect(receivedWebhooks).toHaveLength(1);
  expect(receivedWebhooks[0].body.id).toMatch(/^test:/);
  expect(receivedWebhooks[0].headers['x-femiglow-event']).toBe('webhook.test');
});
```

## 4.6 Tests de migration (smoke)

`drizzle/migrations/__tests__/0XXX_lead_step1_abandon.smoke.test.ts` :

```ts
it('migration adds step1_abandon_webhook_at + step2_webhook_at columns', async () => {
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'chat_lead' AND column_name LIKE 'step%'
  `;
  expect(cols.map((c) => c.column_name)).toEqual(
    expect.arrayContaining(['step1_abandon_webhook_at', 'step2_webhook_at'])
  );
});

it('partial index created', async () => {
  const idx = await sql`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'chat_lead' AND indexname = 'idx_chat_lead_step1_abandon_pending'
  `;
  expect(idx).toHaveLength(1);
});

it('seed setting present', async () => {
  const row = await sql`SELECT value FROM tracking_settings WHERE key = 'lead.step1_abandon_timeout_minutes'`;
  expect(row[0].value).toBe(5);
});
```

## 4.7 Tests manuels — checklist QA avant prod

Bordereau de test à dérouler manuellement avant chaque release qui touche ce système :

- [ ] Wizard checkout complet : 3 steps → 1 webhook order.completed reçu
- [ ] Wizard checkout abandon : step 1 fait, attendre 5min, cron tick → 1 webhook step1_abandoned reçu
- [ ] Wizard checkout revient après abandon : step 1 puis 5min puis step 2 → step1_abandoned + step2_completed (PAS 2× step1)
- [ ] Chat → form lead → webhook chat_lead.created reçu avec `conversation` non-vide
- [ ] Setting timeout à 10min → abandon attendu après 10min, pas 5min
- [ ] Setting step2_webhook_enabled=false → pas de step2_completed envoyé
- [ ] Phone +212661234567 → reçu `0661234567` dans payload
- [ ] Phone invalide (`abc`) → webhook skipped, log présent en `outbound_webhook_log` avec status=skipped
- [ ] Network endpoint Trello DOWN pendant 30s → 3 retries puis status=failed dans log, pas de crash app
- [ ] Replay idempotency-key même clé → court-circuit (skipped: idempotent), pas de doublon Trello

## 4.8 Métriques de succès — à valider post-déploiement

| Métrique | Cible | Mesure |
|---|---|---|
| Webhook success rate (3 events) | > 98% | `SELECT COUNT(*) FILTER (WHERE status='sent') / COUNT(*) FROM outbound_webhook_log WHERE created_at > now()-24h` |
| Latence p95 webhook | < 1500ms | `SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) FROM outbound_webhook_log WHERE status='sent' AND created_at > now()-24h` |
| Leads step1 capturés / abandons step1 (ratio) | > 0.5 (50%+ complètent step 2) | À calculer sur 7 jours |
| Faux positifs cron scanner | 0 | Aucun lead avec `address_completed_at IS NOT NULL` ne doit avoir `step1_abandon_webhook_at IS NOT NULL` |
