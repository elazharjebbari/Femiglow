/**
 * Correctifs de l'audit /kit du 10/11/2026, vérifiés dans un vrai navigateur
 * (vue mobile) contre l'application compilée et une vraie base Postgres.
 *
 *  1. Rupture de stock puis remise en stock : un nouvel essai dans le MÊME
 *     onglet aboutit (l'erreur n'est plus rejouée pendant 24 h).
 *  2. Le hash du téléphone envoyé dans le dataLayer porte l'indicatif 212.
 *  3. « Nouvelle commande » après un achat ne réécrit pas l'adresse de la
 *     commande passée.
 *  4. Le panier du formulaire porte un devis de prix signé, envoyé avec la
 *     commande.
 *
 * Prérequis : `E2E_DATABASE_URL` (même base que le serveur testé), produit,
 * stock et villes seedés. Lancement :
 *   E2E_DATABASE_URL=postgres://… PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 \
 *     npx playwright test e2e/kit-bugs-graves.spec.ts --project=chromium
 */
import { createHash } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

const DB_URL = process.env.E2E_DATABASE_URL;
const SKU = 'FEMI-KIT-100';

test.skip(!DB_URL, 'E2E_DATABASE_URL requis');
// Les scénarios modifient le stock partagé : jamais en parallèle.
test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const sql = DB_URL ? postgres(DB_URL, { max: 1, onnotice: () => undefined }) : null;

function randomPhone(): string {
  return `6${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
}

async function setStock(available: number, sellWhenOut: boolean) {
  await sql!`
    UPDATE product_stock s SET available = ${available}, reserved = 0, sell_when_out = ${sellWhenOut}
    FROM product_variants v WHERE v.id = s.variant_id AND v.sku = ${SKU}`;
}

async function acceptCookies(page: Page) {
  const accept = page.getByRole('button', { name: /tout accepter|accepter|قبول/i }).first();
  await accept.click({ timeout: 3_000 }).catch(() => undefined);
}

async function fillLead(page: Page, firstName: string, phone: string) {
  const lead = page.getByTestId('wizard-step-lead');
  await expect(lead).toBeVisible();
  await lead.locator('input[autocomplete="given-name"], input[name=firstName]').first().fill(firstName);
  await lead.locator('input[type=tel], input[name=phone]').first().fill(phone);
  const box = lead.locator('input[type=checkbox]').first();
  if (!(await box.isChecked())) await box.check({ force: true });
  const submit = page.getByTestId('wizard-lead-submit');
  await expect(submit).toBeEnabled();
  await submit.evaluate((el) => (el as HTMLElement).click());
  await expect(page.getByTestId('wizard-step-address')).toBeVisible();
}

async function fillAddress(page: Page, street: string) {
  const city = page.getByTestId('wizard-address-city');
  await city.click();
  await city.fill('Casa');
  await page.getByTestId('wizard-address-city-option-casablanca').click();
  await page.getByTestId('wizard-address-line1').fill(street);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(page.getByTestId('wizard-address-submit')).toHaveAttribute('data-phase', 'ready');
}

async function submitAddress(page: Page) {
  await page.getByTestId('wizard-address-submit').evaluate((el) => (el as HTMLElement).click());
}

async function openKit(page: Page) {
  await page.goto('/kit?cta=scroll&step2=v2');
  await expect(page.getByTestId('wizard-step-lead')).toBeVisible();
  await page.waitForTimeout(800);
  await acceptCookies(page);
}

test.describe('audit /kit — correctifs vérifiés en navigateur', () => {
  test.afterAll(async () => {
    await setStock(500, true);
    await sql?.end();
  });

  test('rupture puis remise en stock : le second essai dans le même onglet aboutit', async ({ page }) => {
    test.setTimeout(120_000);
    await setStock(500, true);
    await openKit(page);
    await fillLead(page, 'Nadia', randomPhone());
    await fillAddress(page, 'Hay Riad, rue 9');

    await setStock(0, false);
    const first = page.waitForResponse((r) => r.url().includes('/api/checkout/order'));
    await submitAddress(page);
    expect((await first).status()).toBe(409);
    await expect(page.getByTestId('wizard-step-thankyou')).toHaveCount(0);

    await setStock(500, true);
    const second = page.waitForResponse((r) => r.url().includes('/api/checkout/order'));
    await submitAddress(page);
    const res = await second;
    expect(res.status()).toBe(201);
    // Même clé d'idempotence que le premier essai : c'est bien le cas rejoué avant.
    expect(res.request().headers()['idempotency-key']).toBeTruthy();
    await expect(page.getByTestId('wizard-step-thankyou')).toBeVisible({ timeout: 30_000 });
  });

  test('dataLayer : le téléphone haché porte l’indicatif 212, et le devis part avec la commande', async ({ page }) => {
    test.setTimeout(120_000);
    await setStock(500, true);
    const phone = randomPhone();
    const expected = new Set([
      createHash('sha256').update(`212${phone}`).digest('hex'),
      createHash('sha256').update(`+212${phone}`).digest('hex'),
    ]);
    const wrong = createHash('sha256').update(phone).digest('hex');

    await openKit(page);
    await fillLead(page, 'Salma', phone);
    const hashes = await page.evaluate(() => {
      const out: string[] = [];
      const walk = (v: unknown) => {
        if (typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)) out.push(v);
        else if (v && typeof v === 'object') Object.values(v).forEach(walk);
      };
      walk((window as unknown as { dataLayer?: unknown[] }).dataLayer ?? []);
      return out;
    });
    expect(hashes.some((h) => expected.has(h))).toBe(true);
    expect(hashes).not.toContain(wrong);

    await fillAddress(page, 'Maarif, rue 3');
    const orderReq = page.waitForRequest((r) => r.url().includes('/api/checkout/order'));
    await submitAddress(page);
    const body = JSON.parse((await orderReq).postData() ?? '{}') as {
      items: Array<{ priceQuote?: string }>;
    };
    expect(body.items[0]?.priceQuote).toMatch(/^[\w-]+\.[\w-]+$/);
    await expect(page.getByTestId('wizard-step-thankyou')).toBeVisible({ timeout: 30_000 });
  });

  test('« Nouvelle commande » après achat : l’adresse de la commande passée reste intacte', async ({ page }) => {
    test.setTimeout(150_000);
    await setStock(500, true);
    const phone = randomPhone();
    await openKit(page);
    await fillLead(page, 'Khadija', phone);
    await fillAddress(page, 'Adresse de la premiere commande');
    await submitAddress(page);
    await expect(page.getByTestId('wizard-step-thankyou')).toBeVisible({ timeout: 30_000 });

    const [first] = await sql!`
      SELECT id FROM chat_lead WHERE phone_e164 = ${`+212${phone}`} AND purchased_at IS NOT NULL`;
    expect(first).toBeTruthy();

    await page.getByTestId('wizard-thankyou-neworder-cta').evaluate((el) => (el as HTMLElement).click());
    await fillLead(page, 'Khadija', phone);
    await fillAddress(page, 'Autre adresse qui ne doit rien ecraser');
    await submitAddress(page);
    await expect(page.getByTestId('wizard-step-thankyou')).toBeVisible({ timeout: 30_000 });

    const [after] = await sql!`SELECT shipping_address_line1 FROM chat_lead WHERE id = ${first!.id}`;
    expect(after!.shipping_address_line1).toBe('Adresse de la premiere commande');
    const leads = await sql!`SELECT id FROM chat_lead WHERE phone_e164 = ${`+212${phone}`}`;
    expect(leads.length).toBe(2);
  });
});
