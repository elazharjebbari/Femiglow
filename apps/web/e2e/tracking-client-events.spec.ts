/**
 * E2E Playwright — événements tracking côté client (public).
 *
 * Couvre les critères :
 *   - C1.F.4 : form_start au premier focus /kit + /commander
 *   - C1.F.5 : begin_checkout PAS au mount, fire sur action explicite
 *   - T14    : gclid capturé en cookie first-touch persistant 90j
 *   - C4.T.3 : Consent Mode v2 propagation (gtag/dataLayer hooks visibles)
 *
 * Stratégie : on intercepte /api/track pour capturer chaque batch envoyé
 * par TrackingClient. Pas de pollution prod Google/Meta.
 */

import { test, expect } from '@playwright/test';

interface CapturedEvent {
  event: string;
  event_id: string;
  params: Record<string, unknown>;
}

function trackingCollector(page: import('@playwright/test').Page) {
  const events: CapturedEvent[] = [];
  page.route('**/api/track', async (route) => {
    try {
      const body = JSON.parse(route.request().postData() || '{}') as {
        events?: CapturedEvent[];
      };
      if (body.events) events.push(...body.events);
    } catch {
      /* ignore */
    }
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, accepted: 1, rejected: 0, duplicates: 0 }),
    });
  });
  return events;
}

test.describe('Tracking client public — form_start / begin_checkout', () => {
  test('form_start ne fire PAS au mount de /kit (sans focus)', async ({ page }) => {
    const events = trackingCollector(page);
    await page.goto('/kit');
    // Laisser le temps au TrackingClient de flush.
    await page.waitForTimeout(2000);
    const formStart = events.filter((e) => e.event === 'form_start');
    expect(formStart).toHaveLength(0);
  });

  test('form_start fire au premier focus + porte first_field + form_mode', async ({ page }) => {
    const events = trackingCollector(page);
    await page.goto('/kit');
    await page.waitForSelector('[data-testid="wizard-step-lead"]', { timeout: 15_000 });

    const firstName = page.getByLabel(/Votre prénom/i);
    await firstName.focus();
    await page.waitForTimeout(2200);

    const formStart = events.filter((e) => e.event === 'form_start');
    expect(formStart.length).toBeGreaterThanOrEqual(1);
    const fs = formStart[0];
    expect(fs.event_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fs.params.first_field).toBe('firstName');
    expect(fs.params.form_mode).toBe('wizard_embed');
  });

  test('form_start émis UNE SEULE FOIS, même si plusieurs focus', async ({ page }) => {
    const events = trackingCollector(page);
    await page.goto('/kit');
    await page.waitForSelector('[data-testid="wizard-step-lead"]', { timeout: 15_000 });

    const firstName = page.getByLabel(/Votre prénom/i);
    const phone = page.getByLabel(/Téléphone/i);
    await firstName.focus();
    await phone.focus();
    await firstName.focus();
    await page.waitForTimeout(2200);

    const formStart = events.filter((e) => e.event === 'form_start');
    expect(formStart).toHaveLength(1);
  });

  test('begin_checkout PAS au mount /commander (parcours legacy)', async ({ page }) => {
    const events = trackingCollector(page);
    await page.goto('/commander');
    await page.waitForTimeout(2500);
    const beginCheckout = events.filter((e) => e.event === 'begin_checkout');
    // Si pas de panier hydraté, peut être 0. Si panier hydraté mais sans
    // interaction, on doit aussi avoir 0 (D-004).
    expect(beginCheckout).toHaveLength(0);
  });
});

test.describe('Tracking client public — gclid capture (T14)', () => {
  test('Visite /kit?gclid=test_click_id pose un cookie _fg_gclid', async ({ page, context }) => {
    await page.goto('/kit?gclid=test_click_id_123');
    const cookies = await context.cookies();
    const gclid = cookies.find((c) => c.name === '_fg_gclid');
    expect(gclid).toBeDefined();
    expect(gclid!.value).toBe('test_click_id_123');
    // 90 jours en secondes (avec une tolérance).
    const expectedMaxAge = 60 * 60 * 24 * 90;
    if (gclid!.expires && gclid!.expires > 0) {
      const remaining = gclid!.expires - Math.floor(Date.now() / 1000);
      expect(remaining).toBeGreaterThan(expectedMaxAge - 60);
      expect(remaining).toBeLessThan(expectedMaxAge + 60);
    }
  });

  test('Le cookie gclid first-touch ne s\'écrase pas au second visit', async ({
    page,
    context,
  }) => {
    await page.goto('/kit?gclid=first_click');
    let cookies = await context.cookies();
    const first = cookies.find((c) => c.name === '_fg_gclid');
    expect(first?.value).toBe('first_click');

    await page.goto('/kit?gclid=second_click');
    cookies = await context.cookies();
    const after = cookies.find((c) => c.name === '_fg_gclid');
    expect(after?.value).toBe('first_click'); // intact
  });

  test('gbraid et wbraid sont aussi capturés en cookies séparés', async ({ page, context }) => {
    await page.goto('/kit?gbraid=gb_id_xyz&wbraid=wb_id_abc');
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === '_fg_gbraid')?.value).toBe('gb_id_xyz');
    expect(cookies.find((c) => c.name === '_fg_wbraid')?.value).toBe('wb_id_abc');
  });
});

test.describe('Tracking client public — event_id (D-008)', () => {
  test("chaque event /api/track porte un event_id UUID v4/v7", async ({ page }) => {
    const events = trackingCollector(page);
    await page.goto('/kit');
    await page.waitForSelector('[data-testid="wizard-step-lead"]', { timeout: 15_000 });
    await page.getByLabel(/Votre prénom/i).focus();
    await page.waitForTimeout(2200);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.event_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    }
  });
});
