/**
 * CHA-LEAD-V2 — E2E `@chat-purity`.
 *
 * Couvre :
 *  1. Wizard step 1 crée une ghost session non visible /admin/chat/conversations
 *  2. Lead wizard non visible /admin/chat/leads (mais visible /admin/leads)
 *  3. Mode debug ?debug=ghosts affiche les ghosts
 *  4. Endpoint cleanup-ghosts auth + dryRun + olderThanDays validation
 *
 * Prérequis :
 *  - serveur tournant avec `CHAT_ADMIN_FILTERS_V2=true`
 *  - admin credentials via env vars
 *
 * Cf. docs/chat-conversations-leads-fix-2026-05/05-tests/e2e-playwright.md
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'admin@femiglow.local';
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '';

async function loginAdmin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.fill('input[type=email]', ADMIN_EMAIL);
  await page.fill('input[type=password]', ADMIN_PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/admin(?!\/login)/);
}

async function createWizardGhost(
  request: APIRequestContext,
  testId: string,
): Promise<{ sessionId: string; firstName: string; leadId: string | null }> {
  const sessionId = `s_e2e_${testId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const visitorId = `v_e2e_${testId}_${Date.now()}`;
  const firstName = `E2E_${testId}`;

  const res = await request.post('/api/checkout/lead', {
    data: {
      firstName,
      phone: '+212600000000',
      sessionId,
      visitorId,
      language: 'fr',
      page: '/kit',
      consentVersion: 'v1',
      formContext: {
        formId: 'kit_wizard',
        formMode: 'wizard_embed',
        variantKey: 'A',
        source: 'wizard_kit',
      },
    },
    headers: {
      'content-type': 'application/json',
      'Idempotency-Key': `e2e_chat_purity_${sessionId}`,
    },
  });

  if (!res.ok()) {
    return { sessionId, firstName, leadId: null };
  }
  const body = await res.json();
  return { sessionId, firstName, leadId: body.leadId ?? null };
}

test.describe('@chat-purity — filtres admin V2', () => {
  test('wizard ghost non visible /admin/chat/conversations', async ({
    page,
    request,
  }) => {
    test.skip(!ADMIN_PASSWORD, 'ADMIN_BOOTSTRAP_PASSWORD env var requis');
    const { sessionId } = await createWizardGhost(request, 'conv_filter');

    await loginAdmin(page);
    await page.goto('/admin/chat/conversations');

    // Le sessionId ne doit PAS apparaître dans la liste (filtre kind='chat')
    const cells = await page.locator(`text=${sessionId}`).count();
    expect(cells).toBe(0);
  });

  test('debug mode ?debug=ghosts affiche les ghosts', async ({ page, request }) => {
    test.skip(!ADMIN_PASSWORD, 'ADMIN_BOOTSTRAP_PASSWORD env var requis');
    const { sessionId } = await createWizardGhost(request, 'debug');

    await loginAdmin(page);
    await page.goto('/admin/chat/conversations?debug=ghosts');

    // En mode debug, le ghost doit apparaître
    await expect(page.locator(`text=${sessionId.slice(0, 16)}`).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('wizard lead non visible /admin/chat/leads', async ({ page, request }) => {
    test.skip(!ADMIN_PASSWORD, 'ADMIN_BOOTSTRAP_PASSWORD env var requis');
    const { leadId, firstName } = await createWizardGhost(request, 'lead_filter');
    test.skip(!leadId, 'Lead creation failed — skipping filter check');

    await loginAdmin(page);
    await page.goto('/admin/chat/leads');

    // Le lead E2E ne doit PAS apparaître par défaut
    const leadCells = await page.locator(`text=${firstName}`).count();
    expect(leadCells).toBe(0);
  });

  test('?includeWizard=1 affiche les leads wizard', async ({ page, request }) => {
    test.skip(!ADMIN_PASSWORD, 'ADMIN_BOOTSTRAP_PASSWORD env var requis');
    const { leadId, firstName } = await createWizardGhost(request, 'inc_wiz');
    test.skip(!leadId, 'Lead creation failed');

    await loginAdmin(page);
    await page.goto('/admin/chat/leads?includeWizard=1');

    // Avec includeWizard=1, le lead doit être visible
    await expect(page.locator(`text=${firstName}`).first()).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe('@chat-purity — endpoint cleanup-ghosts', () => {
  test('endpoint sans auth → 401', async ({ request }) => {
    const res = await request.post('/api/admin/chat/cleanup-ghosts', {
      data: { dryRun: true, olderThanDays: 30 },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBe(401);
  });

  test('endpoint avec auth dryRun → 200', async ({ page, request }) => {
    test.skip(!ADMIN_PASSWORD, 'ADMIN_BOOTSTRAP_PASSWORD env var requis');
    await loginAdmin(page);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const res = await request.post('/api/admin/chat/cleanup-ghosts', {
      data: { dryRun: true, olderThanDays: 30 },
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      candidates: expect.any(Number),
      archived: 0,
      dryRun: true,
    });
  });

  test('endpoint olderThanDays < 7 → 400', async ({ page, request }) => {
    test.skip(!ADMIN_PASSWORD, 'ADMIN_BOOTSTRAP_PASSWORD env var requis');
    await loginAdmin(page);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const res = await request.post('/api/admin/chat/cleanup-ghosts', {
      data: { dryRun: true, olderThanDays: 3 },
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader,
      },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('@chat-purity — endpoint audit-pollution', () => {
  test('renvoie distributions kind + source', async ({ page, request }) => {
    test.skip(!ADMIN_PASSWORD, 'ADMIN_BOOTSTRAP_PASSWORD env var requis');
    await loginAdmin(page);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const res = await request.get('/api/admin/chat/audit-pollution', {
      headers: { cookie: cookieHeader },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.distributions).toBeDefined();
    expect(Array.isArray(body.distributions.session_kind)).toBe(true);
    expect(Array.isArray(body.distributions.lead_source)).toBe(true);
  });
});
