/**
 * CHA-225 — Tests E2E de capture lead (purchase-intent + phone in-chat).
 *
 * Reproduit les SCÉNARIOS RÉELS reportés par l'utilisateur :
 *
 *  1. Le visiteur tape "je veux commander" → le widget de capture
 *     apparaît immédiatement (raison `purchase-intent`).
 *  2. Le visiteur tape son téléphone dans le chat (ex. "hamid +212751592310")
 *     → un lead automatique est créé même sans soumission du formulaire,
 *     et le widget est proposé (raison `inline-contact`) pour formaliser
 *     le consent.
 *
 * Mode :
 *  - Ces tests utilisent le PIPELINE COMPLET côté API (pas seulement
 *    le widget). Ils n'ont PAS besoin du LLM réel : on tape sur les
 *    routes serveur directement et on lit le SSE renvoyé. Pour le test
 *    UI complet (1.) on dépend tout de même d'un provider OpenAI
 *    actif → gate `OPENAI_LIVE_TEST=1`. Le test 2. ne dépend pas du
 *    contenu de la réponse assistant, donc il fonctionne tant qu'un
 *    provider chat est actif.
 *
 * Pour lancer :
 *
 *   OPENAI_LIVE_TEST=1 PLAYWRIGHT_BASE_URL=http://localhost:3001 \
 *     pnpm exec playwright test chat-lead-capture.spec.ts
 */
import { expect, test } from '@playwright/test';

const SHOULD_RUN = process.env.OPENAI_LIVE_TEST === '1';

/** Lit un stream SSE depuis une réponse Playwright et accumule les évents. */
async function readSseEvents(text: string): Promise<
  Array<{ event: string; data: unknown }>
> {
  const events: Array<{ event: string; data: unknown }> = [];
  const blocks = text.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split('\n');
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) continue;
    const dataStr = dataLines.join('\n');
    let data: unknown = dataStr;
    try {
      data = JSON.parse(dataStr);
    } catch {
      // garde la string brute si pas du JSON
    }
    events.push({ event, data });
  }
  return events;
}

test.describe('Chat lead capture E2E (CHA-225)', () => {
  test.skip(
    !SHOULD_RUN,
    'OPENAI_LIVE_TEST=1 requis : nécessite un provider OpenAI actif.',
  );
  test.setTimeout(60_000);

  test("UI : 'je veux commander' déclenche le widget de capture", async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('chat-launcher').click();
    const composer = page.getByPlaceholder(/message|écrivez|tapez/i);
    await expect(composer).toBeVisible();

    await composer.fill('Je veux commander le kit');
    await composer.press('Enter');

    // Le widget d'offre doit apparaître avec la bonne raison.
    const offer = page.getByTestId('chat-lead-offer');
    await expect(offer).toBeVisible({ timeout: 30_000 });
    await expect(offer).toHaveAttribute('data-reason', 'purchase-intent');

    // Cliquer sur le CTA ouvre le formulaire complet.
    await page.getByTestId('chat-lead-cta').click();
    const form = page.getByTestId('chat-lead-form');
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute('data-reason', 'purchase-intent');
  });

  test("UI : soumission du formulaire après purchase-intent", async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('chat-launcher').click();
    const composer = page.getByPlaceholder(/message|écrivez|tapez/i);
    await composer.fill('Je veux commander le kit');
    await composer.press('Enter');

    const offer = page.getByTestId('chat-lead-offer');
    await expect(offer).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('chat-lead-cta').click();

    const form = page.getByTestId('chat-lead-form');
    await expect(form).toBeVisible();
    await form.locator('input[type="text"]').first().fill('Hamid');
    await form.locator('input[type="tel"]').fill('0612345678');
    await page.getByTestId('chat-lead-submit').click();

    // Le composant bascule en `success` → le formulaire disparaît,
    // un message de confirmation apparaît.
    await expect(form).toBeHidden({ timeout: 15_000 });
    await expect(
      page.getByText(/(conseill|بزاف|ghadi|merci|شكر)/i),
    ).toBeVisible();
  });

  test("API : message avec téléphone → SSE émet 'lead-form-offer' (inline-contact)", async ({
    request,
  }) => {
    // 1. Crée une session.
    const sessRes = await request.get('/api/chat/session');
    expect(sessRes.status()).toBe(200);
    const { sessionId } = (await sessRes.json()) as { sessionId: string };

    // 2. Envoie un message avec un téléphone marocain valide.
    const res = await request.post('/api/chat/message', {
      data: { sessionId, text: 'Bonjour, hamid +212612345678' },
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      timeout: 60_000,
    });
    expect(res.status()).toBe(200);

    const text = await res.text();
    const events = await readSseEvents(text);

    // L'évent lead-form-offer doit être présent avec reason 'inline-contact'.
    const offer = events.find((e) => e.event === 'lead-form-offer');
    expect(offer, 'lead-form-offer event missing').toBeDefined();
    const offerData = offer!.data as { reason?: string };
    expect(offerData.reason).toBe('inline-contact');
  });

  test("API : message avec '290 MAD' (faux positif prix) ne déclenche PAS d'offre", async ({
    request,
  }) => {
    const sessRes = await request.get('/api/chat/session');
    const { sessionId } = (await sessRes.json()) as { sessionId: string };
    const res = await request.post('/api/chat/message', {
      data: {
        sessionId,
        text: "C'est combien le kit ? 290 MAD c'est correct ?",
      },
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      timeout: 60_000,
    });
    expect(res.status()).toBe(200);
    const text = await res.text();
    const events = await readSseEvents(text);
    const offer = events.find((e) => e.event === 'lead-form-offer');
    // Le widget ne DOIT PAS être proposé sur ce message — le prix
    // n'est pas un téléphone, et la requête n'est qu'une question.
    expect(offer, "offer ne doit pas apparaître sur '290 MAD'").toBeUndefined();
  });
});
