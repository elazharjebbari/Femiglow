/**
 * Étape 2 progressive (`?step2=v2`) : parcours réel, géométrie et cas limites.
 *
 * Chromium ne simule ni le clavier virtuel ni les navigateurs intégrés
 * d'Instagram et Facebook : ces points restent à contrôler sur appareils
 * réels, cf. docs/checkout-etape2-conversion/09-tests.md §5.
 */
import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
  { name: 'android 360', width: 360, height: 640 },
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 14', width: 390, height: 844 },
  { name: 'Pixel', width: 412, height: 915 },
];
const LOCALES = [
  { prefix: '', street: 'Hay Salam, rue 4' },
  { prefix: '/ar', street: 'حي السلام، زنقة 4' },
];

/** Le bandeau cookies passe au-dessus des barres fixes : on y répond d'abord. */
async function answerCookies(page: Page): Promise<void> {
  const refuse = page.getByRole('button', { name: /tout refuser|رفض/i }).first();
  await refuse.click({ timeout: 3_000 }).catch(() => undefined);
}

async function goToStep2(page: Page, prefix = '', query = 'step2=v2'): Promise<void> {
  await page.goto(`${prefix}/kit?cta=scroll&${query}`);
  const lead = page.getByTestId('wizard-step-lead');
  await expect(lead).toBeVisible();
  await page.waitForTimeout(800);
  await answerCookies(page);
  await lead.locator('input[autocomplete="given-name"], input[name=firstName]').first().fill('Salma');
  await lead.locator('input[type=tel], input[name=phone]').first().fill('0612345678');
  await lead.locator('input[type=checkbox]').first().check({ force: true });
  const submit = page.getByTestId('wizard-lead-submit');
  await expect(submit).toBeEnabled();
  // Clic direct : le bandeau de cookies peut recouvrir le bouton.
  await submit.evaluate((el) => (el as HTMLElement).click());
  await expect(page.getByTestId('wizard-step-address')).toBeVisible();
  await page.waitForTimeout(900);
}

async function chooseCasablanca(page: Page): Promise<void> {
  await page.getByTestId('wizard-address-city').click();
  await page.getByTestId('wizard-address-city').fill('Casa');
  await page.getByTestId('wizard-address-city-option-casablanca').click();
}

async function fillAddress(page: Page, street = 'Hay Salam, rue 4'): Promise<void> {
  await page.getByTestId('wizard-address-line1').fill(street);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(page.getByTestId('wizard-address-submit')).toHaveAttribute('data-phase', 'ready');
  await page.waitForTimeout(350);
}

async function expectCtaOnScreen(page: Page): Promise<void> {
  const box = await page.getByTestId('wizard-address-submit').evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      inView: rect.top >= 0 && rect.bottom <= window.innerHeight,
      reachable: !!hit && button.contains(hit),
      noOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    };
  });
  expect(box).toEqual({ inView: true, reachable: true, noOverflow: true });
}

test.describe('étape 2 progressive — géométrie', () => {
  for (const { name, width, height } of VIEWPORTS) {
    for (const { prefix, street } of LOCALES) {
      test(`${name} ${prefix || '/fr'} : le bouton reste à l’écran`, async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width, height });
        await goToStep2(page, prefix);
        await expectCtaOnScreen(page);
        await expect(page.getByTestId('sticky-cart-cta')).toHaveAttribute('data-visible', 'false');
        await chooseCasablanca(page);
        await expect(page.getByTestId('wizard-address-line1')).toBeFocused();
        await fillAddress(page, street);
        await expectCtaOnScreen(page);
      });
    }
  }
});

test.describe('étape 2 progressive — parcours', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('total affiché égal au total commandé', async ({ page }) => {
    test.setTimeout(90_000);
    await goToStep2(page);
    await chooseCasablanca(page);
    await fillAddress(page);
    const shown = await page.getByTestId('wizard-action-total-amount').innerText();
    const order = page.waitForResponse(
      (r) => r.url().includes('/api/checkout/order') && r.request().method() === 'POST',
    );
    await page.getByTestId('wizard-address-submit').click();
    const body = (await (await order).json()) as { totalCents: number };
    expect(`${body.totalCents / 100} MAD`).toBe(shown);
    await expect(page.getByTestId('wizard-step-thankyou')).toBeVisible();
  });

  test('adresse facultative : commande créée avec la ville seule', async ({ page }) => {
    test.setTimeout(90_000);
    await goToStep2(page);
    await chooseCasablanca(page);
    await expect(page.getByTestId('wizard-address-submit')).toHaveAttribute('data-phase', 'ready');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.getByTestId('wizard-address-submit').click();
    await expect(page.getByTestId('wizard-step-thankyou')).toBeVisible();
  });

  test('ville hors catalogue : adresse ouverte, 45 MAD comme le serveur', async ({ page }) => {
    test.setTimeout(90_000);
    await goToStep2(page);
    await page.getByTestId('wizard-address-city').click();
    await page.getByTestId('wizard-address-city').fill('Douar Imaginaire');
    await expect(page.getByTestId('wizard-address-reveal')).toHaveAttribute('data-revealed', 'false');
    await page.getByTestId('wizard-address-submit').click();
    await expect(page.getByTestId('wizard-address-line1')).toBeFocused();
    await fillAddress(page, 'Douar centre');
    const shown = parseInt(await page.getByTestId('wizard-action-total-amount').innerText(), 10);
    const order = page.waitForResponse(
      (r) => r.url().includes('/api/checkout/order') && r.request().method() === 'POST',
    );
    await page.getByTestId('wizard-address-submit').click();
    const body = (await (await order).json()) as { totalCents: number };
    expect(body.totalCents / 100).toBe(shown);
  });

  test('erreur serveur : message, saisie conservée, nouvel essai', async ({ page }) => {
    test.setTimeout(90_000);
    await goToStep2(page);
    await chooseCasablanca(page);
    await fillAddress(page);
    let failed = false;
    await page.route('**/api/checkout/order', (route) => {
      if (failed || route.request().method() !== 'POST') return route.continue();
      failed = true;
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"internal"}' });
    });
    await page.getByTestId('wizard-address-submit').click();
    await expect(page.getByTestId('wizard-address-error')).toBeVisible();
    await expect(page.getByTestId('wizard-address-line1')).toHaveValue('Hay Salam, rue 4');
    await page.getByTestId('wizard-address-submit').click();
    await expect(page.getByTestId('wizard-step-thankyou')).toBeVisible();
  });

  test('triple tap : une seule commande', async ({ page }) => {
    test.setTimeout(90_000);
    await goToStep2(page);
    await chooseCasablanca(page);
    await fillAddress(page);
    let orders = 0;
    page.on('request', (r) => {
      if (r.url().includes('/api/checkout/order') && r.method() === 'POST') orders += 1;
    });
    await page.getByTestId('wizard-address-submit').evaluate((el) => {
      const button = el as HTMLElement;
      button.click();
      button.click();
      button.click();
    });
    await expect(page.getByTestId('wizard-step-thankyou')).toBeVisible();
    expect(orders).toBe(1);
  });

  test('rechargement, puis haut de page : données gardées, une seule barre', async ({ page }) => {
    test.setTimeout(90_000);
    await goToStep2(page);
    await chooseCasablanca(page);
    await fillAddress(page);
    await page.reload();
    await expect(page.getByTestId('wizard-address-submit')).toHaveAttribute('data-phase', 'ready');
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByTestId('wizard-action-bar')).toHaveAttribute('data-visible', 'false');
  });
});

test.describe('étape 2 — réglage par défaut', () => {
  test('sans paramètre, la V2 est servie', async ({ page }) => {
    test.setTimeout(90_000);
    await goToStep2(page, '', 'x=1');
    await expect(page.getByTestId('wizard-step-address')).toHaveAttribute('data-variant', 'v2');
    await expect(page.getByTestId('wizard-action-bar')).toBeVisible();
  });

  test('?step2=control ramène l’ancienne version', async ({ page }) => {
    test.setTimeout(90_000);
    await goToStep2(page, '', 'step2=control');
    await expect(page.getByTestId('wizard-step-address')).not.toHaveAttribute('data-variant', 'v2');
    await expect(page.getByTestId('wizard-action-bar')).toHaveCount(0);
  });
});

test.describe('étape 2 — prix promotionnel', () => {
  for (const { name, width, height } of VIEWPORTS) {
    test(`${name} : prix barré et bouton tiennent à l’écran`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height });
      await goToStep2(page);
      await page.evaluate(() => {
        const key = 'femiglow.wizard.v1';
        const stored = JSON.parse(window.localStorage.getItem(key) ?? '{}');
        stored.state = { ...stored.state, couponCode: 'GLOW99', creditCents: 10000, couponKind: 'promo' };
        window.localStorage.setItem(key, JSON.stringify(stored));
      });
      await page.route('**/api/coupons/redeem', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true,"valueCents":10000,"kind":"promo"}' }),
      );
      await page.reload();
      await expect(page.getByTestId('wizard-step-address')).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(900);
      await chooseCasablanca(page);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await expect(page.getByTestId('wizard-action-total-reference')).toBeVisible();
      await page.getByTestId('wizard-step-address').scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await expectCtaOnScreen(page);
    });
  }
});

test.describe('bandeau cookies', () => {
  test('sans réponse à l’étape 2 : ses boutons restent touchables', async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'femiglow.wizard.v1',
        JSON.stringify({ state: { currentStep: 'address', leadId: 'cl_e2e' }, version: 3 }),
      );
    });
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/kit?cta=scroll');
    await expect(page.getByTestId('wizard-step-address')).toBeVisible();
    const refuse = page.getByRole('button', { name: /tout refuser/i }).first();
    await refuse.click({ timeout: 10_000 });
    await expect(refuse).toHaveCount(0);
  });
});

test.describe('étape 1 — case de rappel', () => {
  test('refus mémorisé par le navigateur : la case revient cochée', async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'femiglow.wizard.v1',
        JSON.stringify({ state: { leadDraft: { firstName: '', phone: '', consent: false } }, version: 3 }),
      );
    });
    await page.goto('/kit?cta=scroll');
    await expect(page.locator('input[name=consent]')).toBeChecked();
  });
});

test.describe('étape 1 — numéro pré-rempli', () => {
  for (const value of ['+212 (0)6 12 34 56 78', '+2120612345678', '٠٦١٢٣٤٥٦٧٨']) {
    test(`${value} : accepté`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.goto('/kit?cta=scroll');
      const lead = page.getByTestId('wizard-step-lead');
      await expect(lead).toBeVisible();
      await page.waitForTimeout(800);
      const phone = lead.locator('input[type=tel]').first();
      await phone.fill(value);
      await expect(phone).toHaveValue('06 12 34 56 78');
      await expect(lead.getByText(/Numéro à 9 chiffres/)).toHaveCount(0);
    });
  }
});
