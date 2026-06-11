/**
 * CHA-230 — Tests E2E de robustesse / régression.
 *
 * Reproduit les scénarios reportés en prod et valide que l'ensemble
 * du pipeline (sanitize → lang → intent → charter → RAG → provider →
 * stream → humanize → lead-decision) fonctionne bout-en-bout.
 *
 * Bugs reproduits :
 *  1. "Je souhaite au fait commander" → STUCK sans formulaire (CHA-230).
 *     Le fix patche la regex purchase-intent pour accepter les adverbes.
 *  2. "Je voudrais bien commander" → idem (variante).
 *  3. "Faites-moi un rabais svp" → escalade négociation immédiate.
 *  4. "Je suis grossiste" → escalade wholesaler immédiate.
 *
 * Mode :
 *  - Tests API (route /api/chat/message) : ne dépendent PAS du LLM
 *    quand on cible uniquement les évents `lead-form-offer` car la
 *    décision est purement déterministe.
 *  - Test UI : lance le widget réel, demande au LLM de répondre →
 *    nécessite un provider actif → gate `OPENAI_LIVE_TEST=1`.
 *
 * Pour lancer en local :
 *
 *   PLAYWRIGHT_BASE_URL=http://localhost:3001 \
 *     pnpm exec playwright test chat-robustness.spec.ts
 */
import { expect, test } from '@playwright/test';

const SHOULD_RUN_LIVE = process.env.OPENAI_LIVE_TEST === '1';

interface SseEvent {
  event: string;
  data: unknown;
}

/** Lit un stream SSE depuis le body texte d'une réponse Playwright. */
async function readSseEvents(text: string): Promise<SseEvent[]> {
  const events: SseEvent[] = [];
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

/** Envoie un message et retourne les évents SSE. */
async function sendChatMessage(
  request: import('@playwright/test').APIRequestContext,
  sessionId: string,
  text: string,
): Promise<SseEvent[]> {
  const res = await request.post('/api/chat/message', {
    data: { sessionId, text },
    headers: {
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    timeout: 60_000,
  });
  expect(res.status(), `POST /api/chat/message → ${res.status()}`).toBe(200);
  const body = await res.text();
  return readSseEvents(body);
}

async function createSession(
  request: import('@playwright/test').APIRequestContext,
): Promise<string> {
  const sessRes = await request.get('/api/chat/session');
  expect(sessRes.status()).toBe(200);
  const { sessionId } = (await sessRes.json()) as { sessionId: string };
  expect(sessionId).toBeTruthy();
  return sessionId;
}

test.describe('CHA-230 — Robustesse chat (régression bug prod)', () => {
  test.skip(
    !SHOULD_RUN_LIVE,
    'OPENAI_LIVE_TEST=1 requis : nécessite un provider chat actif.',
  );
  test.setTimeout(60_000);

  // -------------------------------------------------------------------------
  // BUG REGRESSION : "Je souhaite au fait commander"
  // -------------------------------------------------------------------------
  test("'Je souhaite au fait commander' déclenche le formulaire (purchase-intent)", async ({
    request,
  }) => {
    const sessionId = await createSession(request);
    const events = await sendChatMessage(request, sessionId, 'Je souhaite au fait commander');

    const offer = events.find((e) => e.event === 'lead-form-offer');
    expect(offer, 'lead-form-offer attendu (bug prod CHA-230)').toBeDefined();
    const data = offer!.data as { reason?: string };
    expect(data.reason).toBe('purchase-intent');
  });

  test("variantes 'Je voudrais bien commander' déclenchent aussi", async ({ request }) => {
    const sessionId = await createSession(request);
    const events = await sendChatMessage(request, sessionId, 'Je voudrais bien commander');
    const offer = events.find((e) => e.event === 'lead-form-offer');
    expect(offer).toBeDefined();
    expect((offer!.data as { reason?: string }).reason).toBe('purchase-intent');
  });

  test("'Je veux donc commander' (adverbe entre modal/action)", async ({ request }) => {
    const sessionId = await createSession(request);
    const events = await sendChatMessage(request, sessionId, 'Je veux donc commander aujourd’hui');
    const offer = events.find((e) => e.event === 'lead-form-offer');
    expect(offer).toBeDefined();
    expect((offer!.data as { reason?: string }).reason).toBe('purchase-intent');
  });

  // -------------------------------------------------------------------------
  // ESCALADES IMMÉDIATES (négociation, grossiste)
  // -------------------------------------------------------------------------
  test("'Faites-moi un rabais svp' déclenche escalade négociation", async ({ request }) => {
    const sessionId = await createSession(request);
    const events = await sendChatMessage(request, sessionId, 'Faites moi un rabais svp');
    const offer = events.find((e) => e.event === 'lead-form-offer');
    expect(offer).toBeDefined();
    expect((offer!.data as { reason?: string }).reason).toBe('negotiation');
  });

  test("'Je suis grossiste, je veux 100 boîtes' déclenche wholesaler", async ({ request }) => {
    const sessionId = await createSession(request);
    const events = await sendChatMessage(
      request,
      sessionId,
      'Je suis grossiste, je veux 100 boîtes pour mon institut',
    );
    const offer = events.find((e) => e.event === 'lead-form-offer');
    expect(offer).toBeDefined();
    expect((offer!.data as { reason?: string }).reason).toBe('wholesaler');
  });

  // -------------------------------------------------------------------------
  // ANTI-REDONDANCE : 1 seul formulaire par session
  // -------------------------------------------------------------------------
  test('un seul formulaire offert par session, même sur 2 purchase-intent successifs', async ({
    request,
  }) => {
    const sessionId = await createSession(request);
    const ev1 = await sendChatMessage(request, sessionId, 'Je veux commander');
    const offer1 = ev1.find((e) => e.event === 'lead-form-offer');
    expect(offer1).toBeDefined();

    const ev2 = await sendChatMessage(request, sessionId, 'En fait je veux vraiment commander');
    const offer2 = ev2.find((e) => e.event === 'lead-form-offer');
    expect(offer2, 'le 2e message ne doit PAS re-déclencher le formulaire').toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // SCÉNARIO COMPLET : flow conversationnel multi-tours
  // -------------------------------------------------------------------------
  test("flow visitor : 'hello' puis 'je veux commander' → form au 2e tour", async ({
    request,
  }) => {
    const sessionId = await createSession(request);

    // Tour 1 : greeting → pas d'offre
    const ev1 = await sendChatMessage(request, sessionId, 'Hello');
    const offer1 = ev1.find((e) => e.event === 'lead-form-offer');
    expect(offer1, 'pas d’offre au 1er tour si greeting').toBeUndefined();

    // Tour 2 : purchase-intent → offre immédiate
    const ev2 = await sendChatMessage(request, sessionId, 'Je veux commander');
    const offer2 = ev2.find((e) => e.event === 'lead-form-offer');
    expect(offer2).toBeDefined();
    expect((offer2!.data as { reason?: string }).reason).toBe('purchase-intent');
  });

  // -------------------------------------------------------------------------
  // FAUX-POSITIFS : NE DOIT PAS déclencher
  // -------------------------------------------------------------------------
  test("'C'est combien le kit ?' NE déclenche PAS d'offre au 1er tour", async ({ request }) => {
    const sessionId = await createSession(request);
    const events = await sendChatMessage(request, sessionId, "C'est combien le kit ?");
    const offer = events.find((e) => e.event === 'lead-form-offer');
    expect(offer, 'pricing seul ne doit pas déclencher').toBeUndefined();
  });

  test("'J'ai déjà commandé hier' NE déclenche PAS purchase-intent", async ({ request }) => {
    const sessionId = await createSession(request);
    const events = await sendChatMessage(request, sessionId, "J'ai déjà commandé hier");
    const offer = events.find((e) => e.event === 'lead-form-offer');
    // Soit pas d'offre, soit une offre avec reason ≠ purchase-intent.
    if (offer) {
      expect((offer.data as { reason?: string }).reason).not.toBe('purchase-intent');
    }
  });
});

// =============================================================================
// TESTS UI (widget visuel)
// =============================================================================
test.describe('CHA-230 — Robustesse chat (UI widget)', () => {
  test.skip(
    !SHOULD_RUN_LIVE,
    'OPENAI_LIVE_TEST=1 requis : nécessite provider OpenAI + UI complète.',
  );
  test.setTimeout(60_000);

  test("widget : 'Je souhaite au fait commander' affiche le formulaire", async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('chat-launcher').click();
    const composer = page.getByPlaceholder(/message|écrivez|tapez/i);
    await expect(composer).toBeVisible();

    await composer.fill('Je souhaite au fait commander');
    await composer.press('Enter');

    const offer = page.getByTestId('chat-lead-offer');
    await expect(offer).toBeVisible({ timeout: 30_000 });
    await expect(offer).toHaveAttribute('data-reason', 'purchase-intent');
  });

  test("widget : 'rabais' affiche escalade négociation", async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('chat-launcher').click();
    const composer = page.getByPlaceholder(/message|écrivez|tapez/i);
    await composer.fill('Vous me faites un rabais svp ?');
    await composer.press('Enter');

    const offer = page.getByTestId('chat-lead-offer');
    await expect(offer).toBeVisible({ timeout: 30_000 });
    await expect(offer).toHaveAttribute('data-reason', 'negotiation');
  });
});
