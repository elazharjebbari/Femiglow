/**
 * E2E — Vérifie que les pixels tracking (GA4, GTM, Google Ads) sont
 * injectés dans le DOM après mount du PixelLoader.
 *
 * Pré-requis : tracking_settings.consent_default_granted=true et
 * consent_banner_enabled=false (cas actuel du serveur).
 */
import { expect, test, type Page } from '@playwright/test';

/**
 * Attend que `window.ttq` soit défini (le SDK TikTok s'auto-instancie
 * dès qu'`ttq.load(pixelId)` est appelé). Retourne `true` si chargé,
 * `false` si timeout — utilisé pour skip propre quand TikTok n'est pas
 * configuré dans l'env testé.
 */
async function waitForTtq(page: Page, timeoutMs = 6_000): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => typeof (window as unknown as { ttq?: unknown }).ttq === 'object',
      undefined,
      { timeout: timeoutMs },
    );
    return true;
  } catch {
    return false;
  }
}

test.describe('Tracking pixels injection (no consent banner)', () => {
  test('GA4, GTM et Google Ads sont injectés dans le head', async ({ page }) => {
    await page.goto('/kit', { waitUntil: 'domcontentloaded' });
    // PixelLoader attend `requestIdleCallback` puis injecte. Délai large.
    await page.waitForTimeout(3000);

    // Vérifie la présence des scripts injectés (data-tracking-pixel="<kind>")
    const injectedKinds = await page.$$eval(
      'script[data-tracking-pixel]',
      (els) =>
        els.map((el) => el.getAttribute('data-tracking-pixel')).filter(Boolean),
    );

    expect(injectedKinds).toContain('google_ga4');
    expect(injectedKinds).toContain('gtm');
    expect(injectedKinds).toContain('google_ads');

    // Vérifie que gtag.js est chargé pour Google Ads
    const adsScript = await page.$$eval('script[src]', (els) =>
      els
        .map((el) => el.getAttribute('src'))
        .filter((src): src is string => Boolean(src && src.includes('googletagmanager.com/gtag/js'))),
    );
    expect(adsScript.length).toBeGreaterThan(0);

    // Snapshot du DOM pour debug visuel
    await page.screenshot({
      path: 'test-results/tracking-pixels-injection.png',
      fullPage: false,
    });
  });

  // ─── TikTok Pixel via GTM ─────────────────────────────────────────
  //
  // L'env doit avoir : provider tiktok enabled en DB + plan GTM
  // republié avec la balise `TikTok Init` (commit 7cea8a5). Si l'env
  // n'a pas encore promu, on skip proprement plutôt que de fail —
  // les unit tests (vitest) couvrent déjà la logique en isolation.
  test('TikTok pixel charge via la balise GTM (ttq.load + events.js)', async ({ page }) => {
    await page.goto('/kit', { waitUntil: 'domcontentloaded' });

    // Le SDK TikTok est chargé par la balise GTM `TikTok Init` qui fire
    // sur le premier gtm.js (PageView). Avant ttq.load(), `window.ttq`
    // n'existe pas ; après, c'est un objet avec _i[pixelId].
    const ttqLoaded = await waitForTtq(page);
    test.skip(!ttqLoaded, 'TikTok provider not enabled in this env — skip e2e (unit tests cover the logic).');

    // Le SDK officiel TikTok expose `_i[pixelId]` après ttq.load.
    // On vérifie qu'au moins UN pixelId est registered (la clé exacte
    // dépend de la config DB de l'env, on ne la hardcode pas).
    const pixelIds = await page.evaluate(() => {
      const w = window as unknown as { ttq?: { _i?: Record<string, unknown> } };
      return Object.keys(w.ttq?._i ?? {});
    });
    expect(pixelIds.length).toBeGreaterThan(0);
    // Sanity : pas d'ID vide / nullish dans la liste.
    for (const id of pixelIds) {
      expect(id.length).toBeGreaterThanOrEqual(10);
    }

    // Le script officiel events.js doit être présent dans le DOM
    // (injecté par le bootstrap GTM TikTok Init).
    const sdkLoaded = await page.$$eval('script[src]', (els) =>
      els
        .map((el) => el.getAttribute('src') ?? '')
        .some((src) => src.includes('analytics.tiktok.com/i18n/pixel/events.js')),
    );
    expect(sdkLoaded).toBe(true);
  });

  test('aucun snippet TikTok dans /api/track/pixels quand GTM porte le bootstrap', async ({ page }) => {
    // Cf. /api/track/pixels filterForGtm (commit 4651f27). Quand un
    // provider `gtm` est enabled, le snippet TikTok est filtré avant
    // d'être retourné au PixelLoader (sinon double `ttq.page()` non
    // dédupliqué).
    //
    // Note : `gtm.clientSnippet()` retourne null, donc `gtm` n'apparaît
    // JAMAIS dans la liste retournée. On déduit son statut depuis le
    // DOM `<script src=*googletagmanager.com/gtm.js*>` chargé par
    // le SDK GTM côté serveur.
    await page.goto('/kit', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const [snippetKinds, gtmInDom] = await Promise.all([
      page.evaluate(async () => {
        const r = await fetch('/api/track/pixels');
        if (!r.ok) return [] as string[];
        const json = (await r.json()) as { snippets: Array<{ kind: string }> };
        return json.snippets.map((s) => s.kind);
      }),
      page.$$eval('script[src]', (els) =>
        els.some((el) => (el.getAttribute('src') ?? '').includes('googletagmanager.com/gtm.js')),
      ),
    ]);

    // Si GTM est actif dans l'env (cas prod et staging normal), TikTok
    // ne doit pas être dans les snippets côté client. Sinon (env dev
    // pur, sans GTM), on ne fail pas — le test devient informatif.
    if (gtmInDom) {
      expect(snippetKinds).not.toContain('tiktok');
    } else {
      test.skip(true, 'GTM not loaded in this env — anti-double-fire path not exercised.');
    }
  });
});
