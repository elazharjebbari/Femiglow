/**
 * Playwright — Moteur de suggestion (nudge), lot L12.
 *
 * Couvre les scénarios « nudge » du plan `docs/locale-switcher-v2/07-tests/
 * playwright-plan.csv` :
 *
 *   PW-15  INV-12  nudge montré une fois (Accept-Language ar, sans cookie)
 *   PW-16  INV-12  refus persistant à travers navigation + reload (cookie)
 *   PW-17  INV-1/2/12 acceptation → bascule /ar sans reload, nudge disparu
 *   PW-18  INV-12  supprimé quand servi == suggéré (goto /ar direct)
 *   PW-41  INV-5/12 jamais de nudge dans le wizard (mobile)
 *
 * Pré-requis (sinon SKIP, pas d'échec) — EN PLUS des flags V2, le **moteur
 * doit être ALLUMÉ** dans la base de test (OFF par défaut, INV-13). On
 * l'allume via `/admin/i18n/engine` (profil TRIG-ENTRY-MISMATCH activé,
 * surface perle) puis on signale la précondition :
 *
 *   I18N_ENABLED=true NEXT_PUBLIC_LOCALE_SWITCHER_V2=true
 *   LOCALE_ENGINE_E2E=true            # le moteur est allumé dans la DB de test
 *   pnpm build && pnpm start
 *   pnpm test:e2e --grep @locale-switch-nudge
 *
 * Le nudge n'apparaît qu'à un **breakpoint** (INV-17) : une pause de scroll
 * (~600 ms) ou un exit-intent. Les tests provoquent ce breakpoint
 * explicitement après chargement.
 *
 * @see docs/locale-switcher-v2/CONTRACT.md INV-12..INV-20
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

const TRUTHY = new Set(['true', '1', 'on', 'yes', 'enabled']);
function flagOn(v: string | undefined): boolean {
  return v ? TRUTHY.has(v.toLowerCase().trim()) : false;
}

const NUDGE_ACTIVE =
  process.env.I18N_ENABLED === 'true' &&
  flagOn(process.env.NEXT_PUBLIC_LOCALE_SWITCHER_V2) &&
  flagOn(process.env.LOCALE_ENGINE_E2E);

const DISMISS_COOKIE = 'locale_suggestion_dismissed';

/** Contexte « visiteur arabophone » : Accept-Language ar, sans cookie locale. */
async function arabicContext(browser: Browser) {
  return browser.newContext({
    locale: 'ar',
    extraHTTPHeaders: { 'Accept-Language': 'ar,ar-MA;q=0.9' },
  });
}

/**
 * Provoque un breakpoint : petit scroll puis pause > seuil de quiétude
 * (SCROLL_QUIET_MS = 600 ms). Le moteur réévalue à la pause.
 */
async function reachBreakpoint(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(800);
}

test.describe('@locale-switch-nudge Moteur de suggestion', () => {
  test.skip(
    !NUDGE_ACTIVE,
    'I18N_ENABLED + NEXT_PUBLIC_LOCALE_SWITCHER_V2 + LOCALE_ENGINE_E2E requis (cf. en-tête).',
  );

  // ── PW-15 — INV-12 : nudge montré une fois ──────────────────────────────
  test('PW-15 — nudge visible pour un visiteur ar servi en fr', async ({
    browser,
  }) => {
    const context = await arabicContext(browser);
    const page = await context.newPage();
    await page.goto('/fr/');
    await reachBreakpoint(page);

    const prompt = page.getByTestId('locale-suggestion-prompt');
    await expect(prompt).toBeVisible({ timeout: 5000 });
    await expect(prompt).toHaveAttribute('data-suggested', 'ar');
    // Micro-libellé en endonyme arabe (jamais de latin — INV-6).
    await expect(page.getByTestId('locale-suggestion-accept')).toHaveText(
      /[؀-ۿ]/,
    );

    await context.close();
  });

  // ── PW-16 — INV-12 : refus persistant (cookie) à travers nav + reload ───
  test('PW-16 — refus persiste à travers navigation et reload', async ({
    browser,
  }) => {
    const context = await arabicContext(browser);
    const page = await context.newPage();
    await page.goto('/fr/');
    await reachBreakpoint(page);

    const prompt = page.getByTestId('locale-suggestion-prompt');
    await expect(prompt).toBeVisible({ timeout: 5000 });
    await page.getByTestId('locale-suggestion-dismiss').click();
    await expect(prompt).toBeHidden();

    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === DISMISS_COOKIE)?.value).toBe('1');

    // Navigation + reload : le nudge ne réapparaît pas.
    await page.goto('/fr/journal');
    await reachBreakpoint(page);
    await expect(prompt).toBeHidden();
    await page.reload();
    await reachBreakpoint(page);
    await expect(prompt).toBeHidden();

    await context.close();
  });

  // ── PW-17 — INV-1/2/12 : acceptation → bascule ar sans reload ────────────
  test('PW-17 — acceptation bascule en /ar sans reload', async ({
    browser,
  }) => {
    const context = await arabicContext(browser);
    const page = await context.newPage();
    await page.goto('/fr/');
    await reachBreakpoint(page);

    const prompt = page.getByTestId('locale-suggestion-prompt');
    await expect(prompt).toBeVisible({ timeout: 5000 });

    await page.evaluate(() => {
      (window as unknown as { __noReload?: string }).__noReload = 'kept';
    });
    await page.getByTestId('locale-suggestion-accept').click();
    await page.waitForURL(/\/ar(\/|$)/);

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(prompt).toBeHidden();
    const sentinel = await page.evaluate(
      () => (window as unknown as { __noReload?: string }).__noReload,
    );
    expect(sentinel, 'la page a été rechargée à l’acceptation').toBe('kept');

    await context.close();
  });

  // ── PW-18 — INV-12 : supprimé quand servi == suggéré ────────────────────
  test('PW-18 — aucun nudge quand la langue servie est déjà ar', async ({
    browser,
  }) => {
    const context = await arabicContext(browser);
    const page = await context.newPage();
    await page.goto('/ar/');
    await reachBreakpoint(page);

    await expect(page.getByTestId('locale-suggestion-prompt')).toHaveCount(0);

    await context.close();
  });

  // ── PW-41 — INV-5/12 : jamais de nudge dans le wizard (mobile) ──────────
  test('PW-41 — aucun nudge dans le wizard (mobile 375px)', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      locale: 'ar',
      extraHTTPHeaders: { 'Accept-Language': 'ar,ar-MA;q=0.9' },
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await page.goto('/fr/kit');
    // Entrée dans le wizard (CTA d'achat) — la surface wizard interdit le nudge.
    const cta = page
      .getByRole('button', { name: /commander|acheter|kit/i })
      .first();
    if (await cta.isVisible().catch(() => false)) {
      await cta.click();
    }
    await reachBreakpoint(page);

    await expect(page.getByTestId('locale-suggestion-prompt')).toHaveCount(0);

    await context.close();
  });
});
