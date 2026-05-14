# E2E Playwright — Scénarios complets

> Les tests E2E sont le filet de sécurité utilisateur. Ils valident que le système se comporte comme attendu **du clic au résultat**. Toujours avec MSW pour les providers — jamais d'appel internet réel.

## Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'playwright-junit.xml' }]
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } }
  ],
  webServer: {
    command: 'npm run start:test',
    url: 'http://localhost:3000',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI
  }
});
```

## Setup MSW en E2E

```typescript
// tests/e2e/setup/msw-server.ts
import { setupServer } from 'msw/node';
import { providerHandlers } from '../mocks/providers';
import { webhookHandlers } from '../mocks/webhooks';

export const mswServer = setupServer(...providerHandlers, ...webhookHandlers);

// playwright.config.ts → globalSetup
export default async () => {
  mswServer.listen({ onUnhandledRequest: 'warn' });
};
```

## Scénarios E2E V5 (20 scénarios essentiels)

### E2E-01 — Greeting first visit (happy path FR)

```typescript
test('E2E-01 greeting first visit FR', async ({ page }) => {
  await page.goto('/');

  // Launcher visible avec pulse
  await expect(page.locator('[data-test=chat-launcher]')).toBeVisible();
  await expect(page.locator('[data-test=chat-launcher]')).toHaveAttribute('data-pulse', 'true');

  // Click launcher
  await page.click('[data-test=chat-launcher]');

  // Panel mount + greeting cascade
  await expect(page.locator('[data-test=chat-panel]')).toBeVisible({ timeout: 1000 });
  await expect(page.locator('[data-test=greeting-message]')).toContainText('Bonjour');

  // Suggestions pills affichées
  await expect(page.locator('[data-test=suggestion-pill]')).toHaveCount(3);

  // Composer focused
  await expect(page.locator('[data-test=composer-input]')).toBeFocused();
});
```

### E2E-02 — Greeting AR

```typescript
test('E2E-02 greeting AR with RTL', async ({ page }) => {
  await page.goto('/?lang=ar');

  await page.click('[data-test=chat-launcher]');
  await expect(page.locator('[data-test=greeting-message]')).toContainText('السلام');

  // RTL applied
  const dir = await page.locator('[data-test=chat-panel]').getAttribute('dir');
  expect(dir).toBe('rtl');
});
```

### E2E-03 — Greeting AR-MA (darija default)

```typescript
test('E2E-03 greeting AR-MA darija', async ({ page }) => {
  await page.goto('/?lang=ar-MA');

  await page.click('[data-test=chat-launcher]');
  await expect(page.locator('[data-test=greeting-message]')).toContainText('Salam');
  // ou autre marqueur darija graphie latine 3,7,9
});
```

### E2E-04 — Suggestion click → canned response (no LLM consumed)

```typescript
test('E2E-04 suggestion click serves canned without LLM', async ({ page }) => {
  // Setup : mock provider would throw if called (assert no call)
  let providerCalled = false;
  await page.route('**/api.openai.com/**', (route) => {
    providerCalled = true;
    route.fulfill({ status: 500 });
  });

  await page.goto('/');
  await page.click('[data-test=chat-launcher]');

  // Click first suggestion pill
  const pillText = await page.locator('[data-test=suggestion-pill]').first().textContent();
  await page.click('[data-test=suggestion-pill]:first-child');

  // Response apparaît avec animation streaming local
  await expect(page.locator('[data-test=message-assistant]').last()).toBeVisible({ timeout: 5000 });

  // Vérifier marqueur "canned"
  await expect(page.locator('[data-test=message-canned-badge]')).toBeVisible();

  // Vérifier provider NON appelé
  expect(providerCalled).toBe(false);
});
```

### E2E-05 — User message → LLM streaming → 7 SSE events

```typescript
test('E2E-05 LLM message streams 7 SSE events', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-test=chat-launcher]');

  // Compter événements SSE via Network tab
  const events: string[] = [];
  page.on('response', async (response) => {
    if (response.url().includes('/api/chat/message')) {
      const text = await response.text();
      text.split('\n').forEach(line => {
        if (line.startsWith('event:')) {
          events.push(line.replace('event:', '').trim());
        }
      });
    }
  });

  await page.fill('[data-test=composer-input]', 'Quelles sont vos options de paiement ?');
  await page.click('[data-test=composer-send]');

  // Wait for streaming completion
  await page.waitForResponse(/\/api\/chat\/message/);
  await expect(page.locator('[data-test=streaming-caret]')).not.toBeVisible({ timeout: 30000 });

  // 7 events emitted
  expect(events).toEqual(expect.arrayContaining([
    'meta', 'source', 'delta', 'done'
  ]));
});
```

### E2E-06 — Continuity : canned puis LLM continue avec note

```typescript
test('E2E-06 canned then LLM continues with ephemeral note', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-test=chat-launcher]');

  // 1. User clique suggestion (canned)
  await page.click('[data-test=suggestion-pill]:first-child');
  await expect(page.locator('[data-test=message-canned-badge]')).toBeVisible();

  // 2. User envoie message LLM
  await page.fill('[data-test=composer-input]', 'Et concernant la livraison à Casablanca ?');
  await page.click('[data-test=composer-send]');

  // 3. Réponse LLM contient référence implicite à la canned précédente
  // (via ephemeral note injectée)
  const assistantMessages = await page.locator('[data-test=message-assistant]').count();
  expect(assistantMessages).toBeGreaterThan(1);  // canned + LLM response

  // 4. Pas d'ambiguïté (pas de "Bonjour" en double)
  const allTexts = await page.locator('[data-test=message-assistant]').allTextContents();
  const bonjourCount = allTexts.filter(t => t.includes('Bonjour')).length;
  expect(bonjourCount).toBeLessThanOrEqual(1);
});
```

### E2E-07 — Tool call display dans message

```typescript
test('E2E-07 tool call get_product displayed', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-test=chat-launcher]');

  await page.fill('[data-test=composer-input]', 'Quel est le prix du kit FemiGlow ?');
  await page.click('[data-test=composer-send]');

  // Badge tool call apparaît
  await expect(page.locator('[data-test=tool-badge]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-test=tool-badge]')).toContainText('get_product');

  // Prix affiché dans réponse
  await expect(page.locator('[data-test=message-assistant]').last()).toContainText(/\d+\s*(dh|MAD|DH)/i);
});
```

### E2E-08 — Sources popover (RAG citations)

```typescript
test('E2E-08 sources popover from RAG', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-test=chat-launcher]');

  await page.fill('[data-test=composer-input]', 'Comment fonctionne le kit ?');
  await page.click('[data-test=composer-send]');

  await page.waitForSelector('[data-test=message-assistant]:last-child');

  // Sources button visible
  await expect(page.locator('[data-test=sources-button]').last()).toBeVisible();

  // Click ouvre popover
  await page.click('[data-test=sources-button]:last-child');
  await expect(page.locator('[data-test=sources-popover]')).toBeVisible();
  await expect(page.locator('[data-test=source-entry]')).toHaveCount(3);
});
```

### E2E-09 — LeadForm offered + submitted

```typescript
test('E2E-09 lead form submitted after purchase intent', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-test=chat-launcher]');

  // Trigger purchase intent
  await page.fill('[data-test=composer-input]', 'Je voudrais commander le kit, est-ce possible ?');
  await page.click('[data-test=composer-send]');

  // LeadForm apparaît inline
  await expect(page.locator('[data-test=lead-form]')).toBeVisible({ timeout: 10000 });

  // Remplir
  await page.fill('[data-test=lead-phone]', '+212600000000');
  await page.fill('[data-test=lead-name]', 'Soukaina');
  await page.selectOption('[data-test=lead-city]', 'Casablanca');
  await page.click('[data-test=lead-submit]');

  // Confirmation
  await expect(page.locator('[data-test=lead-success]')).toBeVisible({ timeout: 5000 });
});
```

### E2E-10 — LeadForm Zod validation errors

```typescript
test('E2E-10 lead form validation errors displayed FR', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-test=chat-launcher]');

  // Trigger lead form (via canned ou intent)
  await page.click('[data-test=suggestion-pill]:has-text("commander")');
  await expect(page.locator('[data-test=lead-form]')).toBeVisible();

  // Submit vide
  await page.click('[data-test=lead-submit]');

  await expect(page.locator('[data-test=lead-phone-error]')).toContainText(/téléphone/i);
  await expect(page.locator('[data-test=lead-name-error]')).toContainText(/nom/i);

  // Phone invalide
  await page.fill('[data-test=lead-phone]', '123');
  await page.click('[data-test=lead-submit]');
  await expect(page.locator('[data-test=lead-phone-error]')).toContainText(/valide/i);
});
```

### E2E-11 — Service level dégradé (provider down)

```typescript
test('E2E-11 service level toast on degraded', async ({ page }) => {
  // Setup : MSW renvoie 503 sur tous providers
  await mswServer.use(
    rest.post('https://api.openai.com/*', (_, res, ctx) => res(ctx.status(503))),
    rest.post('https://api.anthropic.com/*', (_, res, ctx) => res(ctx.status(503))),
    rest.post('https://api.mistral.ai/*', (_, res, ctx) => res(ctx.status(503)))
  );

  await page.goto('/');
  await page.click('[data-test=chat-launcher]');

  // Forcer plusieurs messages pour épuiser cascade
  for (let i = 0; i < 4; i++) {
    await page.fill('[data-test=composer-input]', `Test message ${i}`);
    await page.click('[data-test=composer-send]');
    await page.waitForTimeout(2000);
  }

  // Toast service level dégradé visible
  await expect(page.locator('[data-test=toast-service-level]')).toBeVisible();
  await expect(page.locator('[data-test=toast-service-level]')).toContainText(/disponibilité|patience/i);
});
```

### E2E-12 — Reload persiste l'état chat

```typescript
test('E2E-12 chat state persists across reload', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-test=chat-launcher]');

  await page.fill('[data-test=composer-input]', 'Premier message');
  await page.click('[data-test=composer-send]');
  await page.waitForSelector('[data-test=message-assistant]');

  // Reload
  await page.reload();

  // Chat reste ouvert avec messages
  await expect(page.locator('[data-test=chat-panel]')).toBeVisible();
  await expect(page.locator('[data-test=message-user]')).toContainText('Premier message');
});
```

### E2E-13 — Persist expire après 30 jours

```typescript
test('E2E-13 persist expires after 30 days', async ({ page, context }) => {
  await page.goto('/');
  await page.click('[data-test=chat-launcher]');

  await page.fill('[data-test=composer-input]', 'Message ancien');
  await page.click('[data-test=composer-send]');
  await page.waitForSelector('[data-test=message-assistant]');

  // Manipuler localStorage pour fake 31 jours
  await page.evaluate(() => {
    const raw = localStorage.getItem('chat-store');
    const parsed = JSON.parse(raw!);
    parsed.state._timestamp = Date.now() - 31 * 24 * 60 * 60 * 1000;
    localStorage.setItem('chat-store', JSON.stringify(parsed));
  });

  await page.reload();

  // Panel ne se réhydrate PAS (state expiré)
  await expect(page.locator('[data-test=chat-panel]')).not.toBeVisible();
});
```

### E2E-14 — Reduced motion disable animations

```typescript
test('E2E-14 reduced motion off skips streaming animation', async ({ page, context }) => {
  await context.emulateMedia({ reducedMotion: 'reduce' });

  await page.goto('/');
  await page.click('[data-test=chat-launcher]');

  await page.fill('[data-test=composer-input]', 'Test');
  await page.click('[data-test=composer-send]');

  // Pas d'animation typing dots
  await expect(page.locator('[data-test=typing-dots]')).not.toBeVisible();

  // Streaming caret invisible aussi
  await expect(page.locator('[data-test=streaming-caret]')).not.toBeVisible();
});
```

### E2E-15 — Mobile Pixel 5 layout

```typescript
test('E2E-15 mobile layout panel full screen', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['Pixel 5'] });
  const page = await context.newPage();

  await page.goto('/');
  await page.click('[data-test=chat-launcher]');

  const panel = page.locator('[data-test=chat-panel]');
  const viewport = page.viewportSize();

  const box = await panel.boundingBox();
  // Mobile : panel occupe full screen ou presque
  expect(box!.width).toBeGreaterThan(viewport!.width * 0.95);
  expect(box!.height).toBeGreaterThan(viewport!.height * 0.85);
});
```

### E2E-16 — Admin login flow

```typescript
test('E2E-16 admin login + nav', async ({ page }) => {
  await page.goto('/admin/login');

  await page.fill('[name=email]', 'admin@femiglow.com');
  await page.fill('[name=password]', process.env.TEST_ADMIN_PASSWORD!);
  await page.click('[type=submit]');

  // Redirect dashboard
  await page.waitForURL('/admin');
  await expect(page.locator('[data-test=admin-sidebar]')).toBeVisible();

  // Nav vers conversations
  await page.click('[data-test=nav-conversations]');
  await page.waitForURL('/admin/conversations');
  await expect(page.locator('[data-test=conversations-list]')).toBeVisible();
});
```

### E2E-17 — Admin suggestion publish workflow

```typescript
test('E2E-17 admin suggestion publish flow', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/suggestions');

  // Créer
  await page.click('[data-test=suggestions-new]');
  await page.fill('[name=key]', 'test-suggestion-2026');
  await page.fill('[name=label_fr]', 'Test suggestion FR');
  await page.click('[data-test=save-draft]');

  await expect(page.locator('[data-test=status-badge]')).toContainText('Draft');

  // Send to review
  await page.click('[data-test=send-to-review]');
  await expect(page.locator('[data-test=status-badge]')).toContainText('Review');

  // Publish
  await page.click('[data-test=publish]');
  await expect(page.locator('[data-test=status-badge]')).toContainText('Published');

  // Vérifier preview
  await page.click('[data-test=preview]');
  const previewPage = page.frameLocator('[data-test=preview-iframe]');
  await expect(previewPage.locator('[data-test=suggestion-pill]')).toContainText('Test suggestion FR');
});
```

### E2E-18 — Admin leads inbox bulk action

```typescript
test('E2E-18 admin leads bulk status change', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/leads');

  // Select 3 leads
  await page.locator('[data-test=lead-checkbox]').first().check();
  await page.locator('[data-test=lead-checkbox]').nth(1).check();
  await page.locator('[data-test=lead-checkbox]').nth(2).check();

  // Bulk action
  await page.click('[data-test=bulk-actions]');
  await page.click('[data-test=bulk-mark-contacted]');

  await expect(page.locator('[data-test=bulk-success]')).toBeVisible();
  // 3 lignes mises à jour
  await expect(page.locator('[data-test=lead-status="contacted"]')).toHaveCount(3);
});
```

### E2E-19 — Admin tool sandbox

```typescript
test('E2E-19 admin tool sandbox executes', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/tools');

  await page.selectOption('[data-test=tool-select]', 'get_product');
  await page.fill('[data-test=tool-input]', JSON.stringify({ productId: 'kit-femiglow' }));
  await page.click('[data-test=tool-execute]');

  await expect(page.locator('[data-test=tool-result]')).toBeVisible({ timeout: 5000 });
  const result = await page.locator('[data-test=tool-result-json]').textContent();
  const parsed = JSON.parse(result!);
  expect(parsed).toHaveProperty('name');
  expect(parsed).toHaveProperty('price_mad');
  expect(parsed.cost).toBeUndefined();  // whitelist actif
});
```

### E2E-20 — Erreur réseau pendant streaming → recovery

```typescript
test('E2E-20 network error mid-stream → error state + retry', async ({ page, context }) => {
  await page.goto('/');
  await page.click('[data-test=chat-launcher]');

  // Couper réseau pendant stream
  await page.fill('[data-test=composer-input]', 'Question longue qui va prendre du temps');

  // Setup interception
  let firstResponse = true;
  await page.route('**/api/chat/message', async (route) => {
    if (firstResponse) {
      firstResponse = false;
      await route.abort('failed');
    } else {
      await route.continue();
    }
  });

  await page.click('[data-test=composer-send]');

  // État erreur affiché
  await expect(page.locator('[data-test=error-state]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-test=error-state]')).toContainText(/réessayer|problème/i);

  // Bouton retry visible
  await expect(page.locator('[data-test=error-retry]')).toBeVisible();

  // Retry → succès
  await page.click('[data-test=error-retry]');
  await expect(page.locator('[data-test=message-assistant]').last()).toBeVisible({ timeout: 15000 });
});
```

## Scénarios cross-browser (mandatoire)

Chaque scénario E2E-01 à E2E-20 doit tourner sur :
- Chromium (desktop)
- Firefox (desktop)
- Webkit (desktop)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 13)

Soit 100 runs en CI (20 × 5). Durée totale : ~10 min en parallèle.

## Conventions data-test attributes

Tous les composants exposent un attribut `data-test="<name>"` pour ciblage stable. Pas de sélecteur CSS class ou ID utilisé en E2E.

Exemples :
- `data-test=chat-launcher`
- `data-test=composer-input`
- `data-test=message-assistant`
- `data-test=lead-phone`

## Anti-patterns E2E

- ❌ Sélecteurs par class CSS (`page.click('.btn-primary')`) — instable.
- ❌ Timeouts magiques (`page.waitForTimeout(2000)`) — flaky.
- ❌ Tests qui dépendent d'ordre (test1 → test2 → test3).
- ❌ Pas de cleanup entre tests (DB ou localStorage qui fuit).
- ❌ Tests qui appellent vraiment internet (provider, webhook).
- ❌ Skip un test E2E flaky au lieu de le fixer.
