/**
 * E2E — UX mobile du widget chat (anti-zoom iOS + sheet full-screen).
 *
 * Suite à un bug prod 2026-05-12 : sur iPhone, le clic dans la textarea
 * du chat déclenchait un auto-zoom iOS Safari et le bouton « Envoyer »
 * disparaissait sous le clavier virtuel. Solution D (sheet responsive
 * sur-mesure) — cf. docs/chat-assistant/21-mobile-ux-plan.md.
 *
 * Design des tests :
 *  - Pas besoin de `PLAYWRIGHT_CROSS=1` : on force la viewport mobile
 *    PER-TEST via `test.use({ viewport: {…} })` pour rester dans le
 *    projet `chromium` par défaut. Une nouvelle suite cross-* serait
 *    overkill pour 5 tests.
 *  - On mock l'API `/api/chat/message` via `page.route()` pour éviter
 *    de dépendre d'un backend (et d'une clé OpenAI réelle) en CI.
 *  - axe-core check sur le panel ouvert pour verrouiller la non-régression
 *    a11y (`maximumScale: 1` interdit, drag-handle `aria-hidden`, etc.).
 */
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Mock SSE minimal pour `/api/chat/message`. Réponse :
 *  - 1 chunk « token » avec un texte court,
 *  - puis `event: done`.
 *
 * On utilise `page.route()` plutôt qu'MSW dans le browser context :
 *  - Playwright intercepte au niveau HTTP avant que la page touche le
 *    réseau, donc pas besoin d'installer un service worker MSW.
 *  - Pour SSE, on renvoie un body string complet (Playwright n'a pas
 *    de streaming natif côté route(), mais le client SSE parse OK un
 *    payload « tout-d'un-coup » qui contient plusieurs `data:`).
 */
const SSE_MOCK_BODY = [
  'event: token',
  'data: {"text":"Bonjour ! "}',
  '',
  'event: token',
  'data: {"text":"Comment puis-je vous aider ?"}',
  '',
  'event: done',
  'data: {}',
  '',
].join('\n');

test.describe('Chat mobile UX (viewport 375×812)', () => {
  // Force viewport mobile pour tous les tests de ce describe.
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page, context }) => {
    // Dismiss le ConsentBanner AVANT la 1ʳᵉ navigation — sinon il se
    // superpose au launcher (z-50) et intercepte les clics. La clé
    // localStorage `fg_consent_chosen='1'` indique au composant que
    // l'utilisateur a déjà choisi. cf. ConsentBanner.tsx l.15.
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem('fg_consent_chosen', '1');
      } catch {
        /* localStorage indispo en SSR / iframes — non-bloquant */
      }
    });
    await page.route('**/api/chat/message', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream; charset=utf-8' },
        body: SSE_MOCK_BODY,
      });
    });
    // Mock aussi `/api/chat/session/*` pour éviter les 404 → le widget
    // peut être plus tolérant qu'on ne le pense, mais autant être safe.
    await page.route('**/api/chat/session/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.goto('/');
  });

  test('focus textarea ⇒ font-size ≥ 16 px + pas de zoom viewport', async ({
    page,
  }) => {
    await page.getByTestId('chat-launcher').click();
    const ta = page.getByTestId('chat-input');
    await ta.focus();

    const fontSize = await ta.evaluate(
      (el) => parseFloat(getComputedStyle(el).fontSize),
    );
    expect(fontSize).toBeGreaterThanOrEqual(16);

    // Sanity check : la viewport CSS n'a pas changé de largeur, i.e.
    // le navigateur n'a pas effectué d'auto-zoom.
    const { docW, winW } = await page.evaluate(() => ({
      docW: document.documentElement.clientWidth,
      winW: window.innerWidth,
    }));
    expect(docW).toBe(winW);
  });

  test('panel ouvert ⇒ couvre toute la viewport (sheet full-screen)', async ({
    page,
  }) => {
    await page.getByTestId('chat-launcher').click();
    const panel = page.getByTestId('chat-panel');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    const vp = page.viewportSize();
    expect(vp).not.toBeNull();
    expect(box).not.toBeNull();
    // Largeur EXACTE = viewport.
    expect(box!.width).toBeCloseTo(vp!.width, 0);
    // Hauteur ≈ viewport (tolérance pour le padding safe-area).
    expect(box!.height).toBeGreaterThanOrEqual(vp!.height - 30);
  });

  test('launcher caché (display:none) en mobile quand le panel est ouvert', async ({
    page,
  }) => {
    const launcher = page.getByTestId('chat-launcher');
    await expect(launcher).toBeVisible();
    await launcher.click();
    await expect(launcher).toBeHidden();
  });

  test('bouton « Envoyer » reste dans la viewport après saisie', async ({
    page,
  }) => {
    await page.getByTestId('chat-launcher').click();
    const ta = page.getByTestId('chat-input');
    await ta.fill('Bonjour');
    const sendBtn = page.getByTestId('chat-send');
    await expect(sendBtn).toBeVisible();
    const box = await sendBtn.boundingBox();
    const vp = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height);
  });

  test('drag-handle visuel est présent en mobile (idiome sheet)', async ({
    page,
  }) => {
    await page.getByTestId('chat-launcher').click();
    await expect(page.getByTestId('chat-panel-drag-handle')).toBeVisible();
  });

  test('aucune violation axe-core sérieuse sur le panel ouvert', async ({
    page,
  }) => {
    await page.getByTestId('chat-launcher').click();
    await page.getByTestId('chat-panel').waitFor({ state: 'visible' });

    const results = await new AxeBuilder({ page })
      .include('[data-testid="chat-panel"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    if (serious.length > 0) {
      // Affichage lisible des violations pour debug CI.
      console.error('axe violations:', JSON.stringify(serious, null, 2));
    }
    expect(serious).toEqual([]);
  });
});

test.describe('Chat desktop UX — régression nulle (viewport 1280×800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem('fg_consent_chosen', '1');
      } catch {
        /* noop */
      }
    });
    await page.route('**/api/chat/message', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream; charset=utf-8' },
        body: 'event: done\ndata: {}\n\n',
      });
    });
    await page.route('**/api/chat/session/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.goto('/');
  });

  test('panel reste bubble 380×~560 bas-droite (pas de full-screen)', async ({
    page,
  }) => {
    await page.getByTestId('chat-launcher').click();
    const panel = page.getByTestId('chat-panel');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    const vp = page.viewportSize()!;
    expect(box).not.toBeNull();
    // Largeur bubble desktop : sm:w-[380px].
    expect(box!.width).toBeCloseTo(380, 1);
    // Ancré à droite : x + width ~ viewport.width - 28 (sm:right-7).
    expect(box!.x + box!.width).toBeGreaterThanOrEqual(vp.width - 60);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width - 10);
    // Hauteur cap à 560 ou contraint par viewport.
    expect(box!.height).toBeLessThanOrEqual(560);
  });

  test('launcher reste visible en desktop quand panel ouvert (sm:flex)', async ({
    page,
  }) => {
    const launcher = page.getByTestId('chat-launcher');
    await launcher.click();
    // En desktop, le FAB cohabite avec la bubble.
    await expect(launcher).toBeVisible();
  });
});
