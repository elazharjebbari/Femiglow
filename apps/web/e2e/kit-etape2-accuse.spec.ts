/**
 * Étape 2 de /kit — accusé de l'étape 1 : « C'est noté, on vous appelle au
 * 06… ». Vue mobile, application compilée, vraie base Postgres.
 * Dossier : docs/kit-etape2-accuse/.
 *
 *   E2E_DATABASE_URL=postgres://… PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 \
 *     npx playwright test e2e/kit-etape2-accuse.spec.ts --project=chromium --no-deps
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
/** `612345678` → `06 12 34 56 78`, tel que la cliente le relit. */
function displayed(phone: string): string {
  return `0${phone}`.replace(/(\d{2})(?=\d)/g, '$1 ');
}

async function freshKit(page: Page, query = '', base = '') {
  const url = `${base}/kit?cta=scroll${query}`;
  await page.goto(url);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(url);
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

async function leadRow(phone: string) {
  const e164 = `+212${phone}`;
  let row: Record<string, unknown> | undefined;
  await expect
    .poll(
      async () => {
        [row] = await sql!`
          SELECT id, first_name, lead_captured_at, address_completed_at, purchased_at,
                 step1_abandon_webhook_at, shipping_city
          FROM chat_lead WHERE phone_e164 = ${e164} ORDER BY created_at DESC LIMIT 1`;
        return Boolean(row);
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return row!;
}

test.describe('Étape 2 — accusé « C’est noté, on vous appelle »', () => {
  test.beforeAll(async () => {
    await sql!`UPDATE product_stock SET available = 500, reserved = 0, sell_when_out = true`;
  });
  test.afterAll(async () => {
    await sql?.end();
  });

  test('arrivée : carte avec le prénom et le numéro relu, et la fiche existe vraiment en base', async ({ page }) => {
    const phone = randomPhone();
    await freshKit(page);
    await fillLead(page, 'Salma', phone);

    const ack = page.getByTestId('wizard-lead-ack');
    await expect(ack).toBeVisible();
    await expect(ack).toHaveAttribute('data-expanded', 'true');
    await expect(ack).toContainText('C’est noté, Salma.');
    await expect(ack).toContainText(`Nous vous appelons au ${displayed(phone)} pour confirmer votre commande.`);
    await expect(page.getByTestId('wizard-step-address')).toContainText('l’appel de confirmation est plus rapide');

    // Ce que la carte affirme est vrai : la fiche est en base, prête pour le
    // scanner d'abandon qui l'envoie au CRM (pas d'adresse, pas d'achat, pas
    // encore envoyée).
    const row = await leadRow(phone);
    expect(row.first_name).toBe('Salma');
    expect(row.lead_captured_at).not.toBeNull();
    expect(row.address_completed_at).toBeNull();
    expect(row.purchased_at).toBeNull();
  });

  test('tout tient à l’écran à l’arrivée, sur 390 × 844 et sur 360 × 640', async ({ page }) => {
    for (const size of [
      { width: 390, height: 844 },
      { width: 360, height: 640 },
    ]) {
      await page.setViewportSize(size);
      await freshKit(page);
      await fillLead(page, 'Salma', randomPhone());
      await expect(page.getByTestId('wizard-lead-ack')).toBeVisible();
      await page.waitForTimeout(1_200); // fin du centrage d'arrivée

      const city = await page.getByTestId('wizard-address-city').boundingBox();
      const bar = await page.getByTestId('wizard-action-bar').boundingBox();
      const ack = await page.getByTestId('wizard-lead-ack').boundingBox();
      expect(city && bar && ack).toBeTruthy();
      // Le champ ville est entier au-dessus de la barre d'action.
      expect(city!.y + city!.height).toBeLessThanOrEqual(bar!.y);
      expect(city!.y).toBeGreaterThan(0);
      // Aucun débordement horizontal.
      expect(ack!.x).toBeGreaterThanOrEqual(0);
      expect(ack!.x + ack!.width).toBeLessThanOrEqual(size.width);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });

  test('premier contact avec le champ ville : la carte devient une ligne, puis la commande se termine comme avant', async ({ page }) => {
    const phone = randomPhone();
    await freshKit(page);
    await fillLead(page, 'Salma', phone);
    const ack = page.getByTestId('wizard-lead-ack');
    await expect(ack).toHaveAttribute('data-expanded', 'true');

    await page.getByTestId('wizard-address-city').tap();
    await expect(ack).toHaveAttribute('data-expanded', 'false');
    await expect(ack).toContainText(`Noté · on vous appelle au ${displayed(phone)}`);

    await page.getByTestId('wizard-address-city').fill('Marrak');
    await page.getByTestId('wizard-address-city-option-marrakech').click();
    await expect(page.getByTestId('wizard-shipping-notice')).toBeVisible();
    await expect(ack).toBeVisible();
    await page.getByTestId('wizard-address-line1').fill('Hay Salam, rue 4, n 12');
    await page.getByTestId('wizard-inline-confirm').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('wizard-step-thankyou')).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(async () => (await leadRow(phone)).purchased_at !== null, { timeout: 15_000 })
      .toBe(true);
    const [order] = await sql!`
      SELECT o.total_cents, o.shipping_cents FROM orders o
      JOIN chat_lead l ON l.id = o.chat_lead_id WHERE l.phone_e164 = ${`+212${phone}`}`;
    expect(order).toBeTruthy();
    expect(Number(order!.total_cents)).toBeGreaterThan(Number(order!.shipping_cents));
  });

  test('elle quitte après l’étape 1 puis revient : l’étape 2 et l’accusé sont toujours là', async ({ page }) => {
    const phone = randomPhone();
    await freshKit(page);
    await fillLead(page, 'Salma', phone);
    await expect(page.getByTestId('wizard-lead-ack')).toBeVisible();
    await leadRow(phone);

    await page.goto('/kit?cta=scroll');
    const address = page.getByTestId('wizard-step-address');
    await address.scrollIntoViewIfNeeded();
    await expect(address).toBeVisible();
    await expect(page.getByTestId('wizard-lead-ack')).toContainText(displayed(phone));
  });

  test('« Modifier » ramène à l’étape 1 ; le nouveau numéro est celui que l’accusé affiche', async ({ page }) => {
    const first = randomPhone();
    const second = randomPhone();
    await freshKit(page);
    await fillLead(page, 'Salma', first);
    await expect(page.getByTestId('wizard-lead-ack')).toContainText(displayed(first));

    await page.getByTestId('wizard-address-back').evaluate((el) => (el as HTMLElement).click());
    const lead = page.getByTestId('wizard-step-lead');
    await expect(lead).toBeVisible();
    await lead.locator('input[type=tel], input[name=phone]').first().fill(second);
    await page.getByTestId('wizard-lead-submit').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('wizard-lead-ack')).toContainText(displayed(second));
    await expect(page.getByTestId('wizard-lead-ack')).not.toContainText(displayed(first));
  });

  test('?ack=off : écran d’avant, sans accusé', async ({ page }) => {
    await freshKit(page, '&ack=off');
    await fillLead(page, 'Salma', randomPhone());
    await expect(page.getByTestId('wizard-step-address')).toHaveAttribute('data-ack', 'false');
    await expect(page.getByTestId('wizard-lead-ack')).toHaveCount(0);
    await expect(page.getByTestId('wizard-step-address')).toContainText('Vous payez à la réception.');
    await expect(page.getByTestId('wizard-step-address')).not.toContainText('appel de confirmation');
  });

  test('/ar/kit : accusé en arabe, de droite à gauche, numéro de gauche à droite', async ({ page }) => {
    test.skip(!AR_BASE, 'E2E_AR_BASE_URL requis');
    const phone = randomPhone();
    await page.goto(`${AR_BASE}/ar/kit?cta=scroll`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${AR_BASE}/ar/kit?cta=scroll`);
    await page.getByRole('button', { name: /tout refuser|رفض/i }).first().click({ timeout: 3_000 }).catch(() => undefined);
    await fillLead(page, 'سلمى', phone);

    const ack = page.getByTestId('wizard-lead-ack');
    await expect(ack).toBeVisible();
    await expect(ack).toContainText('وصلتنا معلوماتكِ، سلمى.');
    const number = ack.locator('bdi');
    await expect(number).toHaveText(displayed(phone));
    await expect(number).toHaveAttribute('dir', 'ltr');
    expect(await ack.evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
  });
});
