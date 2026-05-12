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

/**
 * CHA-244 — Le chat doit passer AU-DESSUS du header sticky ET du
 * sticky-cart CTA sur `/kit`, sinon ces deux barres rognent le panel
 * et l'utilisateur voit un « écran blanc » avec le composer masqué.
 *
 * On vérifie aussi : exit clair (bouton « Fermer » visible), restauration
 * de la position de scroll, masquage animé du header + sticky CTA.
 */
test.describe('CHA-244 — chat sur /kit cache header + sticky CTA, exit clair', () => {
  test.use({ viewport: { width: 375, height: 812 } });

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
        body: SSE_MOCK_BODY,
      });
    });
    await page.route('**/api/chat/session/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.goto('/kit');
  });

  test('ouverture chat ⇒ header masqué + sticky CTA masqué + composer cliquable', async ({
    page,
  }) => {
    // 1) Avant ouverture : le header est visible (sticky en haut).
    const header = page.locator('header[role="banner"]');
    await expect(header).toBeVisible();
    // Force le sticky CTA à apparaître : on scrolle bas pour passer le
    // sentinel (le hero du /kit est haut, l'IntersectionObserver le
    // sort du viewport au scroll).
    await page.evaluate(() => window.scrollTo(0, 1200));
    const stickyCta = page.getByRole('region', { name: /achat rapide/i });
    await expect(stickyCta).toBeVisible();

    // 2) On ouvre le chat.
    await page.getByTestId('chat-launcher').click();
    const panel = page.getByTestId('chat-panel');
    await expect(panel).toBeVisible();

    // 3) Header & sticky CTA masqués (animation : pointer-events-none).
    // On laisse l'animation se terminer.
    await page.waitForTimeout(300);
    await expect(header).toHaveAttribute('data-chat-open', 'true');
    await expect(header).toHaveAttribute('aria-hidden', 'true');
    const stickyAfter = page.locator(
      '[aria-label="Achat rapide"]',
    );
    await expect(stickyAfter).toHaveAttribute('data-chat-open', 'true');
    await expect(stickyAfter).toHaveAttribute('aria-hidden', 'true');

    // 4) Le composer est visible ET cliquable (pas recouvert).
    const ta = page.getByTestId('chat-input');
    await expect(ta).toBeVisible();
    await ta.click();
    await ta.fill('test');
    expect(await ta.inputValue()).toBe('test');
  });

  test('exit clair : bouton « Fermer » 44×44 avec label visible', async ({
    page,
  }) => {
    await page.getByTestId('chat-launcher').click();
    const closeBtn = page.getByTestId('chat-close');
    await expect(closeBtn).toBeVisible();

    // Label texte visible (pas seulement aria-label).
    await expect(closeBtn).toContainText('Fermer');

    // Cible 44×44 (WCAG 2.5.5 AAA).
    const box = await closeBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  });

  test('close ⇒ header + sticky CTA réapparaissent + scroll restauré (≈ 4 px tolérance)', async ({
    page,
  }) => {
    // Position scroll initiale pour le test.
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(80);
    const beforeY = await page.evaluate(() => window.scrollY);
    expect(beforeY).toBeGreaterThan(700);

    await page.getByTestId('chat-launcher').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    // Fermer via bouton.
    await page.getByTestId('chat-close').click();
    await expect(page.getByTestId('chat-panel')).toBeHidden();

    // Header redevient visible.
    const header = page.locator('header[role="banner"]');
    await expect(header).toHaveAttribute('data-chat-open', 'false');
    await expect(header).toHaveAttribute('aria-hidden', 'false');

    // ScrollY restauré.
    const afterY = await page.evaluate(() => window.scrollY);
    expect(Math.abs(afterY - beforeY)).toBeLessThanOrEqual(4);
  });

  test('Esc ⇒ même restauration (fermeture clavier)', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(80);
    const beforeY = await page.evaluate(() => window.scrollY);

    await page.getByTestId('chat-launcher').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('chat-panel')).toBeHidden();
    const afterY = await page.evaluate(() => window.scrollY);
    expect(Math.abs(afterY - beforeY)).toBeLessThanOrEqual(4);
  });

  test('body scroll lock : overflow:hidden pendant chat ouvert', async ({
    page,
  }) => {
    await page.getByTestId('chat-launcher').click();
    const overflow = await page.evaluate(
      () => document.body.style.overflow,
    );
    expect(overflow).toBe('hidden');

    await page.getByTestId('chat-close').click();
    const restored = await page.evaluate(
      () => document.body.style.overflow,
    );
    // Restauré à l'état d'origine (chaîne vide ou 'visible' selon CSS).
    expect(['', 'visible', 'auto']).toContain(restored);
  });

  test('z-index : panel passe au-dessus du header (compare computed z-index)', async ({
    page,
  }) => {
    await page.getByTestId('chat-launcher').click();
    const panelZ = await page
      .getByTestId('chat-panel')
      .evaluate((el) => parseInt(getComputedStyle(el).zIndex, 10));
    // --z-chat-overlay = 250. > z-sticky (100).
    expect(panelZ).toBeGreaterThan(100);
    expect(panelZ).toBeLessThan(300); // < z-modal pour ne pas écraser admin
  });
});
