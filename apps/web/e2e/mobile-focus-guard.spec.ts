/**
 * E2E — `MobileFocusGuard` : verrouillage viewport sur focus de champs texte.
 *
 * Cas régression : iOS Safari (et certains Android) zooment automatiquement
 * sur un input/textarea au focus, ce qui pousse le bouton "Envoyer" hors écran.
 * Solution : patch dynamique `<meta name=viewport>` qui ajoute
 * `maximum-scale=1, user-scalable=no` PENDANT la saisie, retiré au blur.
 *
 * Captures d'écran générées dans `test-results/mobile-focus-guard-*.png`
 * pour validation visuelle.
 */
import { expect, test } from '@playwright/test';

const PUBLIC_PAGE = '/kit'; // page avec un input (form contact, etc.)
const VIEWPORT_LOCKED_RE = /maximum-scale=1.*user-scalable=no|user-scalable=no.*maximum-scale=1/;

async function getViewportContent(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(
    () =>
      document
        .querySelector('meta[name="viewport"]')
        ?.getAttribute('content') ?? '',
  );
}

test.describe('MobileFocusGuard — viewport lock (mobile 375×812)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('viewport initiale : pas de maximum-scale', async ({ page }) => {
    await page.goto(PUBLIC_PAGE, { waitUntil: 'domcontentloaded' });
    const initial = await getViewportContent(page);
    expect(initial).toContain('width=device-width');
    expect(initial).not.toMatch(/maximum-scale/);
    await page.screenshot({
      path: 'test-results/mobile-focus-guard-1-initial.png',
      fullPage: false,
    });
  });

  test('focus textarea chat → viewport verrouillée', async ({ page }) => {
    await page.goto(PUBLIC_PAGE, { waitUntil: 'networkidle' });

    // Ouvre le chat launcher (bouton FAB en bas à droite).
    const launcher = page.getByTestId('chat-launcher');
    await launcher.click();
    const textarea = page.getByTestId('chat-input');
    await expect(textarea).toBeVisible();

    // État avant focus
    const before = await getViewportContent(page);
    expect(before).not.toMatch(VIEWPORT_LOCKED_RE);

    // Focus → lock
    await textarea.focus();
    // Petite attente pour que le listener focusin s'exécute
    await page.waitForFunction(
      () =>
        /maximum-scale=1/.test(
          document
            .querySelector('meta[name="viewport"]')
            ?.getAttribute('content') ?? '',
        ),
      undefined,
      { timeout: 2000 },
    );
    const locked = await getViewportContent(page);
    expect(locked).toMatch(VIEWPORT_LOCKED_RE);

    // Screenshot pour vérif visuelle
    await page.screenshot({
      path: 'test-results/mobile-focus-guard-2-focused.png',
      fullPage: false,
    });

    // Tape un peu — bouton "Envoyer" doit rester visible (cible 44×44).
    await textarea.fill('Bonjour');
    const sendBtn = page.getByTestId('chat-send');
    await expect(sendBtn).toBeVisible();
    const sendBox = await sendBtn.boundingBox();
    expect(sendBox).not.toBeNull();
    if (sendBox) {
      // Le bouton doit être ENTIÈREMENT dans le viewport (375×812).
      expect(sendBox.y + sendBox.height).toBeLessThanOrEqual(812);
      expect(sendBox.x + sendBox.width).toBeLessThanOrEqual(375);
      // Et garder une cible tactile ≥ 44 px (WCAG 2.5.5).
      expect(sendBox.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({
      path: 'test-results/mobile-focus-guard-3-typed.png',
      fullPage: false,
    });
  });

  test('blur textarea → viewport restaurée', async ({ page }) => {
    await page.goto(PUBLIC_PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('chat-launcher').click();
    const textarea = page.getByTestId('chat-input');
    await textarea.focus();
    await page.waitForFunction(
      () =>
        /maximum-scale=1/.test(
          document
            .querySelector('meta[name="viewport"]')
            ?.getAttribute('content') ?? '',
        ),
      undefined,
      { timeout: 2000 },
    );

    // Blur en cliquant ailleurs (header du chat).
    await textarea.blur();
    // Le composant debounce 50 ms avant de restaurer.
    await page.waitForFunction(
      () =>
        !/maximum-scale=1/.test(
          document
            .querySelector('meta[name="viewport"]')
            ?.getAttribute('content') ?? '',
        ),
      undefined,
      { timeout: 2000 },
    );
    const after = await getViewportContent(page);
    expect(after).not.toMatch(VIEWPORT_LOCKED_RE);
    await page.screenshot({
      path: 'test-results/mobile-focus-guard-4-restored.png',
      fullPage: false,
    });
  });

  test('font-size textarea chat ≥ 16 px (seuil iOS anti-zoom)', async ({ page }) => {
    await page.goto(PUBLIC_PAGE, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('chat-launcher').click();
    const textarea = page.getByTestId('chat-input');
    await expect(textarea).toBeVisible();
    const fontSizePx = await textarea.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return parseFloat(cs.fontSize);
    });
    expect(fontSizePx).toBeGreaterThanOrEqual(16);
  });
});
