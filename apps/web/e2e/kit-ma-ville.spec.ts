/**
 * « Ma ville » sur /kit : la livraison chiffrée sous le prix, le panneau de
 * choix de ville, la reprise de la ville à l'étape 2 et le bouton de
 * confirmation intégré au formulaire. Vue mobile, application compilée,
 * vraie base Postgres.
 *
 *   E2E_DATABASE_URL=postgres://… PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 \
 *     npx playwright test e2e/kit-ma-ville.spec.ts --project=chromium --no-deps
 *
 * Optionnel : E2E_AR_BASE_URL (serveur avec I18N_ENABLED=true) pour /ar/kit.
 */
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

const DB_URL = process.env.E2E_DATABASE_URL;
const AR_BASE = process.env.E2E_AR_BASE_URL;

test.skip(!DB_URL, 'E2E_DATABASE_URL requis');
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
test.describe.configure({ mode: 'serial' });

const sql = DB_URL ? postgres(DB_URL, { max: 1, onnotice: () => undefined }) : null;

function randomPhone(): string {
  return `6${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
}

async function freshKit(page: Page, base = '') {
  await page.goto(`${base}/kit?cta=scroll`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${base}/kit?cta=scroll`);
  await page.getByRole('button', { name: /tout refuser|رفض/i }).first().click({ timeout: 3_000 }).catch(() => undefined);
}

async function fillLead(page: Page, firstName: string, phone: string) {
  const lead = page.getByTestId('wizard-step-lead');
  await expect(lead).toBeVisible();
  await lead.locator('input[autocomplete="given-name"], input[name=firstName]').first().fill(firstName);
  await lead.locator('input[type=tel], input[name=phone]').first().fill(phone);
  const box = lead.locator('input[type=checkbox]').first();
  if (!(await box.isChecked())) await box.check({ force: true });
  await page.getByTestId('wizard-lead-submit').evaluate((el) => (el as HTMLElement).click());
  await expect(page.getByTestId('wizard-step-address')).toBeVisible();
}

test.describe('Ma ville — livraison annoncée avant le formulaire', () => {
  test.beforeAll(async () => {
    await sql!`UPDATE product_stock SET available = 500, reserved = 0, sell_when_out = true`;
  });
  test.afterAll(async () => {
    await sql?.end();
  });

  test('fourchette sous le prix, panneau, total exact sur la page et dans la barre fixe', async ({ page }) => {
    await freshKit(page);
    const line = page.getByTestId('delivery-estimate');
    await expect(line).toHaveAttribute('data-known', 'false');
    const [{ min, max }] = await sql!`
      SELECT min(delivery_price_mad)::int AS min, max(delivery_price_mad)::int AS max
      FROM delivery_cities WHERE is_active AND country_code = 'MA'`;
    await expect(page.getByTestId('delivery-estimate-range')).toHaveText(`${min} à ${max} MAD selon votre ville`);

    await page.getByTestId('delivery-estimate-open').click();
    await expect(page.getByTestId('delivery-city-sheet')).toBeVisible();
    // Autocomplétion : une ville hors raccourcis, tapée en partie.
    await page.getByTestId('delivery-city-search').fill('Errach');
    await page.getByTestId('delivery-city-search-option-errachidia').click();
    const [city] = await sql!`SELECT delivery_price_mad AS fee FROM delivery_cities WHERE slug = 'errachidia'`;
    const total = 199 + Number(city!.fee);
    await expect(page.getByTestId('delivery-city-total')).toHaveText(`${total} MAD`);
    await page.getByTestId('delivery-city-validate').click();
    await expect(page.getByTestId('delivery-city-sheet')).toBeHidden();

    await expect(line).toHaveAttribute('data-known', 'true');
    await expect(line).toContainText('Livraison à Errachidia');
    await expect(page.getByTestId('delivery-estimate-total')).toContainText(`${total} MAD`);

    await page.evaluate(() => window.scrollTo(0, 5000));
    await expect(page.getByTestId('sticky-delivery-total')).toContainText(`${total} MAD`);
    await expect(page.getByTestId('sticky-delivery-line')).toContainText(`dont livraison ${city!.fee} MAD`);
  });

  test('ville choisie sur la page : reprise à l’étape 2, bouton intégré, commande au bon montant', async ({ page }) => {
    await freshKit(page);
    await page.getByTestId('delivery-estimate-open').click();
    await page.getByTestId('delivery-city-shortcut-marrakech').click();
    await page.getByTestId('delivery-city-validate').click();

    const phone = randomPhone();
    await page.locator('#commander-femiglow').scrollIntoViewIfNeeded();
    await fillLead(page, 'Imane', phone);

    // Ville déjà là, cochée : rien à choisir.
    const cityInput = page.getByTestId('wizard-address-city');
    await expect(cityInput).toHaveValue('Marrakech');
    await expect(page.getByTestId('wizard-shipping-notice')).toContainText('35 MAD');
    await expect(page.getByTestId('wizard-address-reveal')).toHaveAttribute('data-revealed', 'true');
    await expect(page.getByTestId('wizard-inline-confirm')).toHaveCount(0);

    await page.getByTestId('wizard-address-line1').fill('Gueliz, rue 12');
    const inline = page.getByTestId('wizard-inline-confirm');
    await expect(inline).toBeVisible();
    await expect(inline).toContainText('Confirmer ma commande');
    await expect(inline).toContainText('234 MAD à la réception');
    // Jamais deux boutons identiques : la barre fixe s'efface.
    await expect(page.getByTestId('wizard-action-bar')).toHaveAttribute('data-visible', 'false');

    const order = page.waitForResponse((r) => r.url().includes('/api/checkout/order'));
    await inline.click();
    expect([200, 201]).toContain((await order).status());
    await expect(page.getByTestId('wizard-step-thankyou')).toBeVisible({ timeout: 30_000 });

    const [row] = await sql!`
      SELECT o.total_cents, o.shipping_cents, l.shipping_city, l.shipping_address_line1
      FROM orders o JOIN chat_lead l ON l.id = o.chat_lead_id
      WHERE l.phone_e164 = ${`+212${phone}`} ORDER BY o.created_at DESC LIMIT 1`;
    expect(row).toMatchObject({
      total_cents: 23400,
      shipping_cents: 3500,
      shipping_city: 'Marrakech',
      shipping_address_line1: 'Gueliz, rue 12',
    });
  });

  test('sans ville choisie avant : l’étape 2 demande la ville, comme avant', async ({ page }) => {
    await freshKit(page);
    await page.locator('#commander-femiglow').scrollIntoViewIfNeeded();
    await fillLead(page, 'Hind', randomPhone());
    await expect(page.getByTestId('wizard-address-city')).toHaveValue('');
    await expect(page.getByTestId('wizard-address-reveal')).toHaveAttribute('data-revealed', 'false');
  });

  test('arabe (/ar/kit) : ligne, panneau et bouton intégré en arabe', async ({ page }) => {
    test.skip(!AR_BASE, 'E2E_AR_BASE_URL non fourni');
    await freshKit(page, AR_BASE!);
    await page.goto(`${AR_BASE}/ar/kit?cta=scroll`);
    const line = page.getByTestId('delivery-estimate');
    await expect(line).toHaveAttribute('dir', 'rtl');
    await expect(line).toContainText('التوصيل');
    await page.getByTestId('delivery-estimate-open').click();
    await page.getByTestId('delivery-city-shortcut-marrakech').click();
    await expect(page.getByTestId('delivery-city-total')).toHaveText('234 درهم');
    await page.getByTestId('delivery-city-validate').click();
    await expect(line).toContainText('مراكش');
  });
});
