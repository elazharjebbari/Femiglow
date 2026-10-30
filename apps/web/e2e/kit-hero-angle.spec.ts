import { expect, test, type Page } from '@playwright/test';

/**
 * Kit CRO v2 §3 — titre du hero /kit selon l'angle publicitaire.
 *
 * Résolution serveur : `?angle=` > `?utm_content=` > cookie `fg_angle`.
 * L'angle est exposé en `data-kit-angle` sur la section du hero (lu au clic
 * par les boutons « Commander » pour `add_to_cart.kit_angle`).
 *
 * Les textes par défaut du registre (`kit-hero-angles`) sont lus depuis la
 * base : les assertions de texte supposent `sync:components` lancé et aucun
 * texte FR publié qui les remplace. Les assertions sur l'attribut et le
 * cookie n'en dépendent pas.
 *
 * `?cta=scroll` : comportement de commande stable (cf. kit-commander-sheet).
 */

const hero = (page: Page) => page.locator('section[data-kit-angle]').first();

interface CapturedEvent {
  event: string;
  params: Record<string, unknown>;
}

/** Capture les lots envoyés à /api/track (cf. tracking-client-events.spec). */
function trackingCollector(page: Page): CapturedEvent[] {
  const events: CapturedEvent[] = [];
  void page.route('**/api/track', async (route) => {
    try {
      const body = JSON.parse(route.request().postData() || '{}') as { events?: CapturedEvent[] };
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

test.describe('/kit hero — angle publicitaire', () => {
  test('utm_content=E-darija → angle E (titre « salon ou 99 DH »)', async ({ page }) => {
    await page.goto('/kit?cta=scroll&utm_content=E-darija');

    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');
    const h1 = page.getByRole('heading', { level: 1 }).first();
    await expect(h1).toContainText(/manucure japonaise/i);
    await expect(h1).toContainText(/salon chez vous, pour 99 DH/i);
  });

  test('le nom d’annonce (E_salon-ou-99dh_darija) est aussi reconnu', async ({ page }) => {
    await page.goto('/kit?cta=scroll&utm_content=E_salon-ou-99dh_darija');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');
  });

  test('temoin-* → angle témoin', async ({ page }) => {
    await page.goto('/kit?cta=scroll&utm_content=temoin-manucure-chine');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'temoin');
  });

  test('?angle= (recette) prime sur utm_content', async ({ page }) => {
    await page.goto('/kit?cta=scroll&angle=d&utm_content=E-fr');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'd');
    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(/woudou/i);
  });

  test('sans angle : titre par défaut, aucun cookie posé', async ({ page, context }) => {
    await page.goto('/kit?cta=scroll&utm_content=retargeting');

    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'none');
    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(
      /manucure japonaise/i,
    );
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'fg_angle')).toBeUndefined();
  });

  test('cookie fg_angle : posé depuis l’URL, puis réutilisé sans UTM', async ({ page, context }) => {
    await page.goto('/kit?cta=scroll&utm_content=E-darija');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');

    // Le cookie est posé par le client après hydratation.
    await expect
      .poll(async () => (await context.cookies()).find((c) => c.name === 'fg_angle')?.value)
      .toBe('e');
    const cookie = (await context.cookies()).find((c) => c.name === 'fg_angle')!;
    expect(cookie.path).toBe('/');
    expect(cookie.sameSite).toBe('Lax');
    // ≈ 7 jours (tolérance d'une heure).
    const ttl = cookie.expires - Date.now() / 1000;
    expect(ttl).toBeGreaterThan(7 * 24 * 3600 - 3600);
    expect(ttl).toBeLessThanOrEqual(7 * 24 * 3600 + 60);

    // Retour sans UTM : l'angle est conservé.
    await page.goto('/kit?cta=scroll');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');
    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(/salon/i);

    // Une nouvelle publicité remplace l'angle mémorisé.
    await page.goto('/kit?cta=scroll&utm_content=A-darija');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'a');
    await expect
      .poll(async () => (await context.cookies()).find((c) => c.name === 'fg_angle')?.value)
      .toBe('a');
  });

  test('view_item et add_to_cart portent kit_angle (/api/track)', async ({ page }) => {
    const events = trackingCollector(page);
    await page.goto('/kit?cta=scroll&utm_content=E-fr');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');

    await hero(page).getByRole('button', { name: /je commande/i }).first().click();
    await expect
      .poll(() => events.find((e) => e.event === 'add_to_cart')?.params.kit_angle, {
        timeout: 10_000,
      })
      .toBe('e');
    expect(events.find((e) => e.event === 'view_item')?.params.kit_angle).toBe('e');
  });

  test('/ar/kit : angle sans texte AR publié → titre AR habituel (jamais de français)', async ({
    page,
  }) => {
    await page.goto('/ar/kit?cta=scroll&utm_content=E-darija');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');
    const h1 = page.getByRole('heading', { level: 1 }).first();
    await expect(h1).not.toContainText(/salon chez vous/i);
  });
});
