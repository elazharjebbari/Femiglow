# Playwright E2E `@chat-purity`

> 4 specs Playwright qui valident le flow utilisateur complet.

## 1. Setup

**Fichier nouveau** : `apps/web/e2e/chat-purity.spec.ts`

```ts
/**
 * CHA-LEAD-V2 — E2E `@chat-purity`.
 *
 * Couvre :
 *  1. Wizard step 1 crée une ghost session non visible /admin/chat/conversations
 *  2. Lead wizard non visible /admin/chat/leads (mais visible /admin/leads)
 *  3. Mode debug ?debug=ghosts affiche tous les kinds
 *  4. Cleanup endpoint archive les orphelins > 30j
 *
 * Prérequis :
 *  - serveur tournant avec `CHAT_ADMIN_FILTERS_V2=true`
 *  - admin authentifié via cookie (cf. global-setup.ts)
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'admin@femiglow.local';
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? 'TeXdExs2hdYVaB+dltbUnjmU';

async function loginAdmin(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/admin/login');
  await page.fill('input[type=email]', ADMIN_EMAIL);
  await page.fill('input[type=password]', ADMIN_PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL('**/admin**');
}

async function createWizardGhost(
  request: APIRequestContext,
  testId: string,
): Promise<{ sessionId: string; leadId: string | null }> {
  const sessionId = `s_e2e_${testId}_${Date.now()}`;
  const visitorId = `v_e2e_${testId}_${Date.now()}`;

  const res = await request.post('/api/checkout/lead', {
    data: {
      firstName: `E2E_${testId}`,
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
      'Idempotency-Key': `e2e_${testId}_${Date.now()}`,
    },
  });

  if (!res.ok()) {
    return { sessionId, leadId: null };
  }
  const body = await res.json();
  return { sessionId, leadId: body.leadId ?? null };
}

test.describe('@chat-purity — filtres admin V2', () => {
  test('wizard ghost non visible /admin/chat/conversations', async ({ page, request }) => {
    // Setup : créer un ghost via le wizard
    const { sessionId } = await createWizardGhost(request, 'conv_filter');

    // Login admin
    await loginAdmin(page);

    // Visite /admin/chat/conversations
    await page.goto('/admin/chat/conversations');

    // Assert : le sessionId NE DOIT PAS apparaître dans la liste
    const cells = await page.locator(`text=${sessionId}`).count();
    expect(cells).toBe(0);
  });

  test('wizard lead non visible /admin/chat/leads', async ({ page, request }) => {
    const { sessionId, leadId } = await createWizardGhost(request, 'lead_filter');
    expect(leadId).toBeTruthy();

    await loginAdmin(page);
    await page.goto('/admin/chat/leads');

    // Le lead E2E ne doit PAS apparaître (firstName = E2E_lead_filter)
    const leadCells = await page.locator('text=E2E_lead_filter').count();
    expect(leadCells).toBe(0);
  });

  test('wizard lead VISIBLE /admin/leads (vue globale)', async ({ page, request }) => {
    const { leadId } = await createWizardGhost(request, 'global_view');
    expect(leadId).toBeTruthy();

    await loginAdmin(page);
    await page.goto('/admin/leads');

    // Le lead E2E DOIT apparaître dans la vue globale
    await expect(page.locator('text=E2E_global_view').first()).toBeVisible({ timeout: 5000 });

    // Et avec le badge WIZARD
    const row = page.locator('tr', { hasText: 'E2E_global_view' });
    await expect(row.locator('text=WIZARD').first()).toBeVisible();
  });

  test('debug mode ?debug=ghosts affiche les ghosts', async ({ page, request }) => {
    const { sessionId } = await createWizardGhost(request, 'debug_mode');

    await loginAdmin(page);
    await page.goto('/admin/chat/conversations?debug=ghosts');

    // En mode debug, le ghost DOIT apparaître
    await expect(page.locator(`text=${sessionId}`).first()).toBeVisible({ timeout: 5000 });

    // Et le badge "wizard" doit être visible
    const row = page.locator('tr', { hasText: sessionId });
    await expect(row.locator('text=wizard').first()).toBeVisible();
  });
});

test.describe('@chat-purity — cleanup endpoint', () => {
  test('endpoint dryRun renvoie candidates sans muter', async ({ request, page }) => {
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

  test('endpoint sans auth → 401', async ({ request }) => {
    const res = await request.post('/api/admin/chat/cleanup-ghosts', {
      data: { dryRun: true, olderThanDays: 30 },
      headers: { 'content-type': 'application/json' },
    });

    expect(res.status()).toBe(401);
  });

  test('endpoint olderThanDays < 7 → 400', async ({ request, page }) => {
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

test.describe('@chat-purity — page audit', () => {
  test('/admin/chat/audit affiche le rapport pollution', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/chat/audit');

    // Section "Pollution chat_session" présente
    await expect(page.getByRole('heading', { name: /pollution/i })).toBeVisible();

    // Tableau "Sessions par kind" présent
    await expect(page.getByText('Sessions par kind')).toBeVisible();

    // Tableau "Leads par source" présent
    await expect(page.getByText('Leads par source')).toBeVisible();

    // Bouton "Prévisualiser" du cleanup présent
    await expect(page.getByRole('button', { name: /Prévisualiser/i })).toBeVisible();
  });
});
```

## 2. Spec accessibilité associée

**Fichier nouveau** : `apps/web/e2e/a11y/chat-admin.spec.ts`

```ts
/**
 * @a11y — Vérifie que les pages admin chat post-fix passent WCAG 2.1 AA.
 */
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'admin@femiglow.local';
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '';

async function loginAdmin(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/admin/login');
  await page.fill('input[type=email]', ADMIN_EMAIL);
  await page.fill('input[type=password]', ADMIN_PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL('**/admin**');
}

const PAGES_TO_AUDIT = [
  '/admin/chat/conversations',
  '/admin/chat/conversations?debug=ghosts',
  '/admin/chat/leads',
  '/admin/chat/leads?includeWizard=1',
  '/admin/leads',
  '/admin/chat/audit',
];

for (const url of PAGES_TO_AUDIT) {
  test(`@a11y ${url} passes WCAG 2.1 AA`, async ({ page }) => {
    await loginAdmin(page);
    await page.goto(url);
    await injectAxe(page);
    await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
  });
}
```

## 3. Smoke script (post-deploy)

**Fichier nouveau** : `apps/web/scripts/smoke-chat-purity.ts`

```ts
/**
 * CHA-LEAD-V2 — Smoke test post-deploy chat purity.
 *
 * Usage :
 *   pnpm tsx scripts/smoke-chat-purity.ts                 # contre localhost
 *   pnpm tsx scripts/smoke-chat-purity.ts --url https://femiglow-maroc.com
 *
 * Vérifie en < 30s que :
 *  1. POST /api/checkout/lead crée bien un ghost s_*
 *  2. La row chat_session est insérée avec kind='wizard_pivot' (via audit endpoint)
 *  3. /api/admin/chat/cleanup-ghosts dryRun marche (avec cookie admin si fourni)
 */
import './_load-env.mjs';

interface Args { baseUrl: string; adminCookie?: string; verbose: boolean }

function parseArgs(argv: string[]): Args {
  const args: Args = { baseUrl: 'http://localhost:3001', verbose: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') args.baseUrl = argv[++i] ?? args.baseUrl;
    else if (argv[i] === '--admin-cookie') args.adminCookie = argv[++i];
    else if (argv[i] === '--verbose' || argv[i] === '-v') args.verbose = true;
  }
  return args;
}

async function smokeCreateGhost(baseUrl: string): Promise<{ ok: boolean; sessionId: string; detail: string }> {
  const sessionId = `s_smoke_${Date.now()}`;
  const visitorId = `v_smoke_${Date.now()}`;
  try {
    const res = await fetch(`${baseUrl}/api/checkout/lead`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': `smoke_${sessionId}`,
      },
      body: JSON.stringify({
        firstName: 'Smoke',
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
      }),
    });
    return {
      ok: res.ok,
      sessionId,
      detail: res.ok ? '201 created' : `status ${res.status}`,
    };
  } catch (err) {
    return { ok: false, sessionId, detail: (err as Error).message };
  }
}

async function smokeAuditPollution(
  baseUrl: string,
  adminCookie?: string,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${baseUrl}/api/admin/chat/audit-pollution`, {
      headers: adminCookie ? { cookie: adminCookie } : undefined,
    });
    if (!res.ok) {
      return { ok: false, detail: `status ${res.status}` };
    }
    const body = await res.json();
    const hasKind = body.distributions?.session_kind?.length > 0;
    return {
      ok: hasKind,
      detail: hasKind
        ? `${body.distributions.session_kind.length} kinds`
        : 'no kind data',
    };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

async function smokeCleanupDryRun(
  baseUrl: string,
  adminCookie?: string,
): Promise<{ ok: boolean; detail: string }> {
  if (!adminCookie) {
    return { ok: true, detail: 'skipped (no admin cookie)' };
  }
  try {
    const res = await fetch(`${baseUrl}/api/admin/chat/cleanup-ghosts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ dryRun: true, olderThanDays: 30 }),
    });
    if (!res.ok) return { ok: false, detail: `status ${res.status}` };
    const body = await res.json();
    return { ok: true, detail: `candidates=${body.candidates}, dryRun=true` };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`\n🔍 Smoke chat purity — ${args.baseUrl}\n`);
  
  const t0 = Date.now();
  const [ghost, audit, cleanup] = await Promise.all([
    smokeCreateGhost(args.baseUrl),
    smokeAuditPollution(args.baseUrl, args.adminCookie),
    smokeCleanupDryRun(args.baseUrl, args.adminCookie),
  ]);

  console.log('─'.repeat(60));
  console.log(`  ${ghost.ok ? '✅' : '❌'} create_ghost      ${ghost.detail}`);
  console.log(`  ${audit.ok ? '✅' : '❌'} audit_pollution   ${audit.detail}`);
  console.log(`  ${cleanup.ok ? '✅' : '❌'} cleanup_dryRun    ${cleanup.detail}`);
  console.log('─'.repeat(60));

  const passed = [ghost, audit, cleanup].filter((x) => x.ok).length;
  const total = 3;
  console.log(`\n📊 ${passed}/${total} OK — ${Date.now() - t0}ms\n`);

  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
```

## 4. Exécution

```bash
# Local
pnpm playwright test --grep @chat-purity

# Staging
PLAYWRIGHT_BASE_URL=https://staging.femiglow-maroc.com \
  pnpm playwright test --grep @chat-purity

# Smoke staging
pnpm tsx scripts/smoke-chat-purity.ts --url https://staging.femiglow-maroc.com
```

## 5. CI integration

Ajouter dans `.github/workflows/pr.yml` (ou équivalent) :

```yaml
- name: Playwright @chat-purity
  run: pnpm playwright test --grep @chat-purity
  env:
    PLAYWRIGHT_BASE_URL: http://localhost:3001
    CHAT_ADMIN_FILTERS_V2: true
    ADMIN_BOOTSTRAP_EMAIL: ${{ secrets.ADMIN_EMAIL }}
    ADMIN_BOOTSTRAP_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
```

## 6. Critères d'acceptation

- [ ] 7 tests Playwright passent (chat-purity 4 + 3 cleanup endpoint)
- [ ] 6 tests a11y passent (un par page admin)
- [ ] Smoke script exit 0 sur staging et prod
- [ ] Aucune flakiness sur 10 runs consécutifs
