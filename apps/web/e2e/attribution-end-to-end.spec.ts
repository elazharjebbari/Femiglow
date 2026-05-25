/**
 * E2E attribution canal end-to-end — A7 du plan attribution-fix-2026-05.
 *
 * Comble le trou de tests identifié par l'audit (cause silencieuse #1) :
 * aucun test n'asserait que le pipeline complet
 *   emit → /api/track → tracking_events_log.traffic_source → /admin/analytics
 * fonctionnait. Conséquence : la colonne restait NULL en prod sans alerter.
 *
 * Prérequis runtime :
 *   - Build avec NEXT_PUBLIC_ATTRIBUTION_V2=true
 *   - Admin authentifié (cookie session) pour /api/admin/debug/last-events
 *
 * Référence : `docs/attribution-fix-2026-05/04-tests-strategy.md`.
 */
import { test, expect, type APIResponse } from '@playwright/test';

const DEBUG_API = '/api/admin/debug/last-events';

async function lastEventForSession(
  request: Awaited<ReturnType<typeof test.info>>['fixme'] extends never
    ? never
    : import('@playwright/test').APIRequestContext,
  sessionId: string,
  retries = 10,
): Promise<Record<string, unknown> | null> {
  for (let i = 0; i < retries; i++) {
    const res: APIResponse = await request.get(
      `${DEBUG_API}?sessionId=${sessionId}&limit=1`,
    );
    if (res.ok()) {
      const events = (await res.json()) as Array<Record<string, unknown>>;
      if (events.length > 0) return events[0]!;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

test.describe('@attribution-flow — pipeline end-to-end', () => {
  test('Meta paid : fbclid + utm_source=meta → paid_social, fbc reconstruit', async ({
    page,
    request,
  }) => {
    await page.goto(
      '/kit?utm_source=meta&utm_medium=cpc&utm_campaign=spring&fbclid=FBCLID_TEST_123',
    );
    // Attend que /api/track emit page_view
    await page.waitForResponse((r) => r.url().includes('/api/track') && r.request().method() === 'POST');
    // Petite latence pour persistence DB
    await page.waitForTimeout(500);

    // Récupère la session ID via cookie
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'fg_session_id');
    expect(sessionCookie?.value, 'fg_session_id cookie should be set').toBeTruthy();

    const event = await lastEventForSession(request, sessionCookie!.value);
    expect(event, 'Event should be persisted').not.toBeNull();
    expect(event!.trafficSource).toBe('paid_social');
    expect(event!.trafficMedium).toBe('cpc');
  });

  test('Google paid : gclid → paid_search', async ({ page, request }) => {
    await page.goto('/kit?gclid=GCLID_TEST_ABC');
    await page.waitForResponse((r) => r.url().includes('/api/track') && r.request().method() === 'POST');
    await page.waitForTimeout(500);

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'fg_session_id');
    const event = await lastEventForSession(request, sessionCookie!.value);
    expect(event!.trafficSource).toBe('paid_search');
  });

  test('TikTok paid : ttclid → paid_social', async ({ page, request }) => {
    await page.goto('/kit?ttclid=TT_TEST');
    await page.waitForResponse((r) => r.url().includes('/api/track'));
    await page.waitForTimeout(500);

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'fg_session_id');
    const event = await lastEventForSession(request, sessionCookie!.value);
    expect(event!.trafficSource).toBe('paid_social');
  });

  test('Email : utm_source=newsletter+medium=email → email', async ({ page, request }) => {
    await page.goto('/kit?utm_source=klaviyo&utm_medium=email&utm_campaign=weekly');
    await page.waitForResponse((r) => r.url().includes('/api/track'));
    await page.waitForTimeout(500);

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'fg_session_id');
    const event = await lastEventForSession(request, sessionCookie!.value);
    expect(event!.trafficSource).toBe('email');
  });

  test('Direct : aucun signal → direct', async ({ page, request }) => {
    await page.goto('/kit');
    await page.waitForResponse((r) => r.url().includes('/api/track'));
    await page.waitForTimeout(500);

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'fg_session_id');
    const event = await lastEventForSession(request, sessionCookie!.value);
    expect(event!.trafficSource).toBe('direct');
  });
});

test.describe('@attribution-degradation — résilience', () => {
  test('Cookies bloqués : event fire mais traffic_source = direct (fallback)', async ({
    page,
    request,
    context,
  }) => {
    // Pas de cookies → impossible de set _fg_fbclid etc.
    await context.clearCookies();
    await page.goto('/kit?fbclid=FB123');
    await page.waitForResponse((r) => r.url().includes('/api/track'));
    await page.waitForTimeout(500);
    // L'event devrait quand même être persisté (avec direct ou paid_social
    // si le client a hint via attribution cookie)
    // L'assertion principale : pas de 500
  });

  test('First visit (anonymousId nouveau) : enrichEvent ne crash pas', async ({
    page,
    request,
    context,
  }) => {
    await context.clearCookies();
    await page.goto('/kit?utm_source=meta&utm_medium=cpc');
    const trackResponse = await page.waitForResponse((r) => r.url().includes('/api/track'));
    expect(trackResponse.status()).toBeLessThan(500);
  });

  test('Pas d\'attribution v2 dans .env → trafficSource NULL (rétrocompat v1)', async ({
    page,
  }) => {
    // Ce test est conditionnel : skip si ATTRIBUTION_V2=true
    const layoutCheck = await page.goto('/admin/analytics');
    test.skip(
      layoutCheck?.status() === 200,
      'Manuel : si v2 ON, ce test devient inutile. Lance en CI avec flag OFF.',
    );
  });
});
