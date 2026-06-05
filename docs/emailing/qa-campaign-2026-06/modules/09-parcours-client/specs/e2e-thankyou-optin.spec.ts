/**
 * CLI-E2E-001..005 — Page merci : opt-in email post-achat (parcours opérateur/client).
 *
 * Parcours « Kaoutar » bout-en-bout dans un vrai navigateur :
 *   commande -> page merci -> saisie email + consentement -> succès
 *   -> confirmation lue dans Mailpit -> désabonnement -> plus aucun mail.
 *
 * Dépôt cible : apps/web/e2e/emails-parcours-client.spec.ts
 * Prérequis : build local + DB de test + Mailpit (cf. 05-conventions §6).
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:8025';

async function readLastEmail(request: APIRequestContext, to: string) {
  const res = await request.get(`${MAILPIT}/api/v1/search`, {
    params: { query: `to:${to}`, limit: '1' },
  });
  const { messages } = await res.json();
  return messages?.[0] ?? null;
}

async function countEmails(request: APIRequestContext, to: string): Promise<number> {
  const res = await request.get(`${MAILPIT}/api/v1/search`, {
    params: { query: `to:${to}`, limit: '50' },
  });
  const { messages } = await res.json();
  return Array.isArray(messages) ? messages.length : 0;
}

/**
 * Helper : crée une commande de test et renvoie son orderId + l'URL page merci.
 * S'appuie sur un endpoint de seed E2E (cf. e2e/_helpers) ; à adapter au repo.
 */
async function seedOrder(request: APIRequestContext): Promise<{ orderId: string; thankYouUrl: string }> {
  const res = await request.post('/api/test/seed-order', {
    data: { firstName: 'Kaoutar', totalCents: 19900, currency: 'MAD', items: 1 },
  });
  const { orderId, thankYouUrl } = await res.json();
  return { orderId, thankYouUrl };
}

test.describe('Page merci — opt-in email (CLI-E2E)', () => {
  test('CLI-E2E-001/005 : Kaoutar opte, reçoit sa confirmation', async ({ page, request }) => {
    const email = `kaoutar+${Date.now()}@exemple.test`;
    const { thankYouUrl } = await seedOrder(request);

    await page.goto(thankYouUrl);

    // Consentement + email
    await page.getByLabel(/recevoir.*conseils|email/i).fill(email);
    await page.getByRole('checkbox', { name: /consens|accepte|recevoir/i }).check();
    await page.getByRole('button', { name: /valider|s.inscrire|recevoir/i }).click();

    // Oracle UI : succès visible, pas de faux succès.
    await expect(page.getByText(/merci|confirmé|enregistré/i)).toBeVisible();

    // Oracle backend : la confirmation arrive (idempotente par orderId).
    await expect
      .poll(async () => (await readLastEmail(request, email)) !== null, { timeout: 15_000 })
      .toBe(true);
    const mail = await readLastEmail(request, email);
    expect(mail.Subject).toMatch(/confirmation/i);
  });

  test('CLI-E2E-002 : consentement non coché → envoi bloqué', async ({ page, request }) => {
    const { thankYouUrl } = await seedOrder(request);
    await page.goto(thankYouUrl);
    await page.getByLabel(/email/i).fill('sans-consent@exemple.test');
    // On ne coche PAS la case.
    const submit = page.getByRole('button', { name: /valider|recevoir/i });
    // Soit le bouton est désactivé, soit la soumission affiche une erreur.
    if (await submit.isEnabled()) {
      await submit.click();
      await expect(page.getByText(/consentement|case|accepter/i)).toBeVisible();
    } else {
      await expect(submit).toBeDisabled();
    }
  });

  test('CLI-E2E-003 : erreur serveur → message clair, pas de faux succès', async ({ page, request }) => {
    const { thankYouUrl } = await seedOrder(request);
    await page.route('**/api/checkout/order/*/email', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: { code: 'internal' } }) }),
    );
    await page.goto(thankYouUrl);
    await page.getByLabel(/email/i).fill('err@exemple.test');
    await page.getByRole('checkbox', { name: /consens|accepte|recevoir/i }).check();
    await page.getByRole('button', { name: /valider|recevoir/i }).click();
    await expect(page.getByText(/erreur|réessay|problème/i)).toBeVisible();
    await expect(page.getByText(/merci|confirmé/i)).toHaveCount(0);
  });

  test('CLI-E2E-004/008 : désabonnement → plus aucun mail nulle part', async ({ page, request }) => {
    const email = `unsub+${Date.now()}@exemple.test`;
    const { thankYouUrl } = await seedOrder(request);
    await page.goto(thankYouUrl);
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole('checkbox', { name: /consens|accepte|recevoir/i }).check();
    await page.getByRole('button', { name: /valider|recevoir/i }).click();
    await expect(page.getByText(/merci|confirmé/i)).toBeVisible();

    // Récupère le lien d'unsubscribe depuis l'email reçu.
    await expect
      .poll(async () => (await readLastEmail(request, email)) !== null, { timeout: 15_000 })
      .toBe(true);
    const mail = await readLastEmail(request, email);
    const detail = await request.get(`${MAILPIT}/api/v1/message/${mail.ID}`);
    const html = (await detail.json()).HTML as string;
    const unsubUrl = /href="([^"]*\/api\/mail\/unsubscribe[^"]*)"/.exec(html)?.[1];
    expect(unsubUrl, 'le mail doit porter un lien de désabonnement').toBeTruthy();

    await page.goto(unsubUrl!);
    await expect(page.getByText(/désinscription confirmée|plus de communications/i)).toBeVisible();

    // Oracle final : on déclenche un nouvel envoi et on vérifie 0 nouveau mail.
    const before = await countEmails(request, email);
    await request.post('/api/test/trigger-broadcast', { data: { email } }); // helper E2E
    await page.waitForTimeout(2000);
    const after = await countEmails(request, email);
    expect(after, 'après unsub : aucun nouveau mail nulle part').toBe(before);
  });
});
