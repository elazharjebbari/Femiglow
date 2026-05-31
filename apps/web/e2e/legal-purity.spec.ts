/**
 * LEGAL-V2 — E2E `@legal-purity`.
 *
 * Couvre :
 *  1. /legal/mentions-legales : pas d'ICE/RC en clair
 *  2. /legal/cgv : devise + délai rétractation affichés
 *  3. /admin/legal/template-vars : présence des nouvelles vars
 *  4. /api/admin/legal/cleanup-e2e : 401 sans auth
 *  5. Marketing pages : no founder name
 *
 * Cf. docs/pages-legales-fix-2026-05/05-tests/e2e-playwright.md
 */
import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'admin@femiglow.local';
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '';

async function loginAdmin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.fill('input[type=email]', ADMIN_EMAIL);
  await page.fill('input[type=password]', ADMIN_PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/admin(?!\/login)/);
}

test.describe('@legal-purity — pages publiques anonymisées', () => {
  test('mentions-legales : pas d\'ICE 15-chiffres + bloc info sur demande', async ({ page }) => {
    await page.goto('/legal/mentions-legales');
    const html = await page.content();
    // Aucune séquence de 15 chiffres consécutifs (ICE marocain)
    expect(html).not.toMatch(/\b\d{15}\b/);
    // Bloc info sur demande présent (placeholder buildPublicVarMap)
    expect(html).toContain('legal@femiglow-maroc.com');
  });

  test('mentions-legales : pas de RC Ville-NNNN', async ({ page }) => {
    await page.goto('/legal/mentions-legales');
    const html = await page.content();
    expect(html).not.toMatch(/RC\s*:\s*\w+-\d{4,}/);
  });

  test('cgv : devise + délai rétractation affichés', async ({ page }) => {
    await page.goto('/legal/cgv');
    const html = await page.content();
    expect(html).toMatch(/MAD/);
    expect(html).toMatch(/\b7\s*jours?\b/);
  });
});

test.describe('@legal-purity — marketing pages anonymisées', () => {
  const MARKETING_URLS = ['/', '/contact', '/maison', '/kit', '/rituel'];

  for (const url of MARKETING_URLS) {
    test(`${url} : no founder name leak`, async ({ page }) => {
      await page.goto(url);
      const html = await page.content();
      expect(html.toLowerCase()).not.toMatch(/souhei[lï]a/);
    });
  }
});

test.describe('@legal-purity — endpoint cleanup', () => {
  test('endpoint sans auth → 401', async ({ request }) => {
    const res = await request.delete('/api/admin/legal/cleanup-e2e', {
      data: { dryRun: true, olderThanDays: 7 },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBe(401);
  });

  test('endpoint olderThanDays < 7 → 400 (avec auth)', async ({ page, request }) => {
    test.skip(!ADMIN_PASSWORD, 'ADMIN_BOOTSTRAP_PASSWORD env var requis');
    await loginAdmin(page);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const res = await request.delete('/api/admin/legal/cleanup-e2e', {
      data: { dryRun: true, olderThanDays: 3 },
      headers: { 'content-type': 'application/json', cookie: cookieHeader },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('@legal-purity — admin template-vars create', () => {
  test('création nouvelle variable via API', async ({ page, request }) => {
    test.skip(!ADMIN_PASSWORD, 'ADMIN_BOOTSTRAP_PASSWORD env var requis');
    await loginAdmin(page);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const testKey = `E2E_TEST_VAR_${Date.now()}`;
    const res = await request.post('/api/admin/legal/template-vars', {
      data: {
        key: testKey,
        label: 'E2E Test variable',
        value: 'test',
        isRequired: false,
      },
      headers: { 'content-type': 'application/json', cookie: cookieHeader },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body.key).toBe(testKey);
  });

  test('rejette key invalide (lowercase)', async ({ page, request }) => {
    test.skip(!ADMIN_PASSWORD, 'ADMIN_BOOTSTRAP_PASSWORD env var requis');
    await loginAdmin(page);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const res = await request.post('/api/admin/legal/template-vars', {
      data: { key: 'invalid_lowercase', label: 'Test' },
      headers: { 'content-type': 'application/json', cookie: cookieHeader },
    });
    expect([400, 422]).toContain(res.status());
  });
});
