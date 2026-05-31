/**
 * CHA-231 (gap 5) — Tests E2E mockés : 11 reasons + 4 gaps.
 *
 * Pourquoi ces tests :
 *   - Les tests "live" (chat-live-openai, chat-robustness) dépendent
 *     d'un provider OpenAI actif et sont gatés par OPENAI_LIVE_TEST=1.
 *     Ils valident le pipeline FULL mais sont coûteux et flaky.
 *   - CES tests-ci tournent SANS aucune dépendance externe : on mock
 *     entièrement /api/chat/session, /api/chat/message (SSE),
 *     /api/chat/lead-status et /api/chat/lead/contact via
 *     `page.route(...)`. Ils valident la chaîne UI : SSE → store →
 *     LeadFormBubble pour TOUS les motifs (`reason`) du contrat,
 *     ainsi que les 4 gaps identifiés dans CHA-231 :
 *       - gap 1 : SSE drop recovery via /api/chat/lead-status.
 *       - gap 2 : buffer d'offre quand le formulaire est ouvert.
 *       - gap 3 : `force=true` bypasse une dismissal antérieure.
 *       - gap 5 : couverture exhaustive des reasons en E2E.
 *
 * Pré-requis :
 *   - Un dev server Next.js doit tourner (page d'accueil servie),
 *     mais aucun provider chat n'est nécessaire.
 *
 * Pour lancer :
 *   PLAYWRIGHT_BASE_URL=http://localhost:3000 \
 *     pnpm exec playwright test chat-lead-capture-mocked.spec.ts
 */
import { expect, test, type Page, type Route } from '@playwright/test';

import type { ChatLeadTriggerReason } from '../src/lib/chat/contracts';

// =============================================================================
// HELPERS — SSE body builder + page setup
// =============================================================================

interface SseEventInit {
  event: string;
  data: unknown;
}

/** Construit un body SSE valide à partir d'une liste d'évents. */
function buildSseBody(events: SseEventInit[]): string {
  return (
    events
      .map(
        (e) =>
          `event: ${e.event}\ndata: ${typeof e.data === 'string' ? e.data : JSON.stringify(e.data)}`,
      )
      .join('\n\n') + '\n\n'
  );
}

interface MessageMockOptions {
  messageId?: string;
  /** Texte que le serveur "stream" en chunks. */
  reply?: string;
  /** Si défini, ajoute un évènement `lead-form-offer`. */
  leadOffer?: {
    reason: ChatLeadTriggerReason;
    copyKey: string;
    force?: boolean;
  };
  /** Si vrai, n'émet PAS de `lead-form-offer` même si le serveur l'aurait fait. */
  dropOffer?: boolean;
}

/** Construit la séquence SSE standard (start → chunks → end → optional offer). */
function buildMessageStream(opts: MessageMockOptions = {}): string {
  const messageId = opts.messageId ?? 'm_mock_1';
  const reply = opts.reply ?? 'Bonjour ! Je peux vous aider.';
  const events: SseEventInit[] = [
    { event: 'start', data: { messageId, language: 'fr' } },
  ];
  // Split reply en chunks de ~10 chars pour simuler le stream.
  for (let i = 0; i < reply.length; i += 10) {
    events.push({
      event: 'chunk',
      data: { messageId, delta: reply.slice(i, i + 10) },
    });
  }
  events.push({
    event: 'end',
    data: { messageId, latencyMs: 250 },
  });
  if (opts.leadOffer && !opts.dropOffer) {
    events.push({
      event: 'lead-form-offer',
      data: {
        messageId,
        reason: opts.leadOffer.reason,
        copyKey: opts.leadOffer.copyKey,
        ...(opts.leadOffer.force !== undefined && { force: opts.leadOffer.force }),
      },
    });
  }
  return buildSseBody(events);
}

interface LeadStatusMockOptions {
  hasPendingOffer?: boolean;
  leadCaptured?: boolean;
  lastOffer?: {
    messageId: string;
    reason: string;
    copyKey: string;
    force?: boolean;
  };
}

/** Configure les mocks par défaut sur la `page` avant le `goto`. */
async function installBaseMocks(page: Page, sessionId = 'cs_mock_session_1'): Promise<void> {
  // 1. Session : retourne un snapshot minimal valide.
  await page.route('**/api/chat/session*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId,
        language: 'fr',
        status: 'active',
        greeting: 'Bonjour, je peux vous aider.',
        suggestions: [],
        messages: [],
        themeVariantId: 'default',
        variantOpaqueId: 'opaque_test',
      }),
    });
  });

  // 2. Tracking events : 200 vide (no-op).
  await page.route('**/api/chat/event', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  // 3. Lead contact : succès par défaut. Tests qui veulent un autre
  //    comportement re-route plus spécifiquement.
  await page.route('**/api/chat/lead/contact', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        leadId: 'cl_mock_1',
        outcomeMessage: 'Merci ! On vous rappelle dans les minutes qui viennent.',
      }),
    });
  });

  // 4. Lead-status : par défaut, aucune offre en attente.
  await page.route('**/api/chat/lead-status*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        hasPendingOffer: false,
        leadCaptured: false,
      }),
    });
  });

  // 5. Theme : 200 minimal (silence si l'app le pull).
  await page.route('**/api/chat/theme*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
}

/** Mock spécifique d'un POST /api/chat/message avec une séquence d'events SSE. */
async function mockMessageOnce(page: Page, body: string): Promise<void> {
  let used = false;
  await page.route('**/api/chat/message', async (route: Route) => {
    if (used) {
      // Si le test envoie un 2e message sans réinstaller le mock, on
      // retourne un stream vide pour éviter de tomber sur le vrai
      // serveur. Les tests doivent gérer cela explicitement via
      // `mockMessageOnce` à chaque envoi.
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: buildSseBody([
          { event: 'start', data: { messageId: 'm_unused', language: 'fr' } },
          { event: 'end', data: { messageId: 'm_unused', latencyMs: 1 } },
        ]),
      });
      return;
    }
    used = true;
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body,
    });
  });
}

/** Configure une réponse spécifique pour /api/chat/lead-status. */
async function mockLeadStatus(page: Page, opts: LeadStatusMockOptions): Promise<void> {
  await page.unroute('**/api/chat/lead-status*');
  await page.route('**/api/chat/lead-status*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        hasPendingOffer: opts.hasPendingOffer ?? false,
        leadCaptured: opts.leadCaptured ?? false,
        ...(opts.lastOffer && { lastOffer: { ...opts.lastOffer, offeredAt: new Date().toISOString() } }),
      }),
    });
  });
}

/** Ouvre le widget, attend le composer, envoie un message. */
async function sendMessage(page: Page, text: string): Promise<void> {
  const composer = page.getByTestId('chat-input');
  if (!(await composer.isVisible().catch(() => false))) {
    await page.getByTestId('chat-launcher').click();
    await expect(composer).toBeVisible();
  }
  await composer.fill(text);
  await composer.press('Enter');
}

// =============================================================================
// SUITE 1 — Couverture exhaustive des 11 reasons (gap 5)
// =============================================================================

interface ReasonCase {
  reason: ChatLeadTriggerReason;
  copyKey: string;
}

const ALL_REASONS: ReasonCase[] = [
  { reason: 'explicit-request', copyKey: 'explicit-request' },
  { reason: 'out-of-knowledge', copyKey: 'out-of-knowledge' },
  { reason: 'objection-repeat', copyKey: 'objection' },
  { reason: 'long-no-progress', copyKey: 'manual' },
  { reason: 'frustration', copyKey: 'manual' },
  { reason: 'after-hours', copyKey: 'after-hours' },
  { reason: 'b2b', copyKey: 'b2b' },
  { reason: 'purchase-intent', copyKey: 'purchase-intent' },
  { reason: 'inline-contact', copyKey: 'inline-contact' },
  { reason: 'negotiation', copyKey: 'negotiation' },
  { reason: 'wholesaler', copyKey: 'wholesaler' },
];

test.describe('CHA-231 gap 5 — 11 reasons E2E mockés', () => {
  test.setTimeout(20_000);

  for (const { reason, copyKey } of ALL_REASONS) {
    test(`reason "${reason}" → formulaire affiché`, async ({ page }) => {
      await installBaseMocks(page);
      await mockMessageOnce(
        page,
        buildMessageStream({
          messageId: `m_${reason}`,
          leadOffer: { reason, copyKey },
        }),
      );
      await page.goto('/');
      await sendMessage(page, `Test reason ${reason}`);

      const offer = page.getByTestId('chat-lead-offer');
      await expect(offer).toBeVisible({ timeout: 10_000 });
      await expect(offer).toHaveAttribute('data-reason', reason);
    });
  }
});

// =============================================================================
// SUITE 2 — Soumission complète + persistance success
// =============================================================================

test.describe('CHA-231 — Soumission complète du formulaire', () => {
  test.setTimeout(20_000);

  test("CTA → form visible → fill → submit → message succès", async ({ page }) => {
    await installBaseMocks(page);
    await mockMessageOnce(
      page,
      buildMessageStream({
        messageId: 'm_submit',
        leadOffer: { reason: 'purchase-intent', copyKey: 'purchase-intent' },
      }),
    );
    await page.goto('/');
    await sendMessage(page, 'Je veux commander');

    // Étape 1 : offre visible.
    await expect(page.getByTestId('chat-lead-offer')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('chat-lead-cta').click();

    // Étape 2 : form affiché.
    const form = page.getByTestId('chat-lead-form');
    await expect(form).toBeVisible();

    // Étape 3 : fill + submit.
    let submittedPayload: { firstName?: string; phoneRaw?: string; triggerReason?: string } = {};
    await page.unroute('**/api/chat/lead/contact');
    await page.route('**/api/chat/lead/contact', async (route) => {
      submittedPayload = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          leadId: 'cl_mock_submit',
          outcomeMessage: 'Reçu ! On vous rappelle.',
        }),
      });
    });

    await form.locator('input[type="text"]').first().fill('Hamid');
    await form.locator('input[type="tel"]').fill('0612345678');
    await page.getByTestId('chat-lead-submit').click();

    // Étape 4 : success.
    await expect(form).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText('Reçu ! On vous rappelle.')).toBeVisible();

    // Étape 5 : payload contient les bons champs.
    expect(submittedPayload.firstName).toBe('Hamid');
    expect(submittedPayload.phoneRaw).toBe('0612345678');
    expect(submittedPayload.triggerReason).toBe('purchase-intent');
  });
});

// =============================================================================
// SUITE 3 — Gap 1 : SSE drop recovery via /api/chat/lead-status
// =============================================================================

test.describe('CHA-231 gap 1 — SSE drop → réconciliation lead-status', () => {
  test.setTimeout(20_000);

  test("SSE sans lead-form-offer + lead-status retourne offre → form visible", async ({
    page,
  }) => {
    await installBaseMocks(page);
    // Mock SSE : SANS lead-form-offer (simule un drop).
    await mockMessageOnce(
      page,
      buildMessageStream({
        messageId: 'm_drop',
        // dropOffer = true → ne pas émettre de lead-form-offer dans le stream
        dropOffer: true,
      }),
    );
    // Mais lead-status retourne une offre en attente côté serveur.
    await mockLeadStatus(page, {
      hasPendingOffer: true,
      leadCaptured: false,
      lastOffer: {
        messageId: 'm_drop',
        reason: 'purchase-intent',
        copyKey: 'purchase-intent',
        force: false,
      },
    });

    await page.goto('/');
    await sendMessage(page, 'Je veux commander');

    // Le stream se termine SANS offer. Mais après, le hook pull
    // /api/chat/lead-status et déclenche `receiveLeadOffer`.
    const offer = page.getByTestId('chat-lead-offer');
    await expect(offer).toBeVisible({ timeout: 10_000 });
    await expect(offer).toHaveAttribute('data-reason', 'purchase-intent');
  });

  test("SSE drop + leadCaptured=true → PAS de form (pas de re-trigger)", async ({ page }) => {
    await installBaseMocks(page);
    await mockMessageOnce(page, buildMessageStream({ messageId: 'm_no_recover', dropOffer: true }));
    // Le serveur dit : "il y avait une offre, mais le lead est déjà capturé".
    await mockLeadStatus(page, {
      hasPendingOffer: false,
      leadCaptured: true,
      lastOffer: {
        messageId: 'm_no_recover',
        reason: 'purchase-intent',
        copyKey: 'purchase-intent',
      },
    });
    await page.goto('/');
    await sendMessage(page, 'Bonjour');

    // L'offre ne doit JAMAIS apparaître.
    await page.waitForTimeout(2000);
    await expect(page.getByTestId('chat-lead-offer')).toHaveCount(0);
  });
});

// =============================================================================
// SUITE 4 — Gap 3 : force=true bypasse une dismissal antérieure
// =============================================================================

test.describe('CHA-231 gap 3 — force=true bypasse leadOfferDismissedSessionId', () => {
  test.setTimeout(20_000);
  const SESSION = 'cs_mock_session_1';

  test("dismissal pré-seedée + offre force=true → form visible", async ({ page }) => {
    // Pré-seed le store persistant : la session a déjà dismissé une offre.
    await page.addInitScript((sessionId) => {
      const persisted = {
        state: {
          sessionId,
          language: 'fr',
          hasInteracted: true,
          leadOfferDismissedSessionId: sessionId,
          leadCapturedSessionId: null,
        },
        version: 0,
      };
      window.localStorage.setItem('femiglow-chat', JSON.stringify(persisted));
    }, SESSION);

    await installBaseMocks(page, SESSION);
    await mockMessageOnce(
      page,
      buildMessageStream({
        messageId: 'm_force',
        leadOffer: {
          reason: 'explicit-request',
          copyKey: 'explicit-request',
          force: true,
        },
      }),
    );
    await page.goto('/');
    await sendMessage(page, 'Envoyez moi le formulaire');

    // L'offre DOIT apparaître malgré la dismissal.
    const offer = page.getByTestId('chat-lead-offer');
    await expect(offer).toBeVisible({ timeout: 10_000 });
    await expect(offer).toHaveAttribute('data-reason', 'explicit-request');
  });

  test("dismissal pré-seedée SANS force → form NON visible", async ({ page }) => {
    await page.addInitScript((sessionId) => {
      const persisted = {
        state: {
          sessionId,
          language: 'fr',
          hasInteracted: true,
          leadOfferDismissedSessionId: sessionId,
          leadCapturedSessionId: null,
        },
        version: 0,
      };
      window.localStorage.setItem('femiglow-chat', JSON.stringify(persisted));
    }, SESSION);

    await installBaseMocks(page, SESSION);
    await mockMessageOnce(
      page,
      buildMessageStream({
        messageId: 'm_no_force',
        leadOffer: {
          reason: 'purchase-intent',
          copyKey: 'purchase-intent',
          // pas de force → comportement legacy.
        },
      }),
    );
    await page.goto('/');
    await sendMessage(page, 'Je veux commander');

    // L'offre ne doit PAS réapparaître après dismissal.
    await page.waitForTimeout(2000);
    await expect(page.getByTestId('chat-lead-offer')).toHaveCount(0);
  });
});

// =============================================================================
// SUITE 5 — Gap 2 : buffer d'offre quand le formulaire est ouvert
// =============================================================================

test.describe('CHA-231 gap 2 — buffer offer + promotion après dismiss', () => {
  test.setTimeout(20_000);

  test("form ouvert + nouvelle offre → bufferée, promue après dismiss", async ({ page }) => {
    await installBaseMocks(page);

    // 1er envoi : déclenche purchase-intent.
    let messageCount = 0;
    await page.route('**/api/chat/message', async (route: Route) => {
      messageCount += 1;
      if (messageCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: buildMessageStream({
            messageId: 'm_first',
            reply: 'Bonjour ! Je peux vous aider.',
            leadOffer: { reason: 'purchase-intent', copyKey: 'purchase-intent' },
          }),
        });
        return;
      }
      // 2e envoi : déclenche negotiation (différent → on saura si promu).
      // Reply différent pour pouvoir attendre son apparition avant de
      // dismisser, sinon le bouton est cliqué AVANT que `lead-form-offer`
      // ne soit traité (le cadenceur retient ~300ms).
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: buildMessageStream({
          messageId: 'm_second',
          reply: 'Compris, regardons la négociation.',
          leadOffer: { reason: 'negotiation', copyKey: 'negotiation' },
        }),
      });
    });

    await page.goto('/');
    await sendMessage(page, 'Je veux commander');

    // Étape 1 : 1ère offre apparaît, ouvrir le form.
    await expect(page.getByTestId('chat-lead-offer')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('chat-lead-cta').click();

    const form = page.getByTestId('chat-lead-form');
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute('data-reason', 'purchase-intent');

    // Étape 2 : on attend que le streaming finisse vraiment (sinon `send()` refuse).
    await expect(page.getByText('Bonjour ! Je peux vous aider.')).toBeVisible({
      timeout: 5_000,
    });

    // Étape 3 : envoyer un 2e message pendant que le formulaire est ouvert.
    //          → l'offre `negotiation` doit être BUFFEREE (pas écrasée).
    await sendMessage(page, 'Au final un rabais ?');

    // Le form reste affiché avec data-reason=purchase-intent.
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute('data-reason', 'purchase-intent');

    // Étape 4 : attendre que l'offre `negotiation` ait été reçue ET bufferée.
    // Le cadenceur retient les events ~300ms pour mimer un humain qui tape.
    // Le `lead-form-offer` n'est traité qu'APRÈS la fin du `end` + cadenceur.
    // On attend l'apparition du 2e message pour s'assurer que le pipeline
    // SSE est complètement consommé (et donc que `pendingLeadOffer` est set).
    await expect(page.getByText('Compris, regardons la négociation.')).toBeVisible({
      timeout: 5_000,
    });
    // Pause supplémentaire pour laisser le `lead-form-offer` post-end fire.
    await page.waitForTimeout(300);

    // Étape 5 : dismiss → le buffer est promu.
    // Le bouton "dismiss" dans le form n'a pas de testid spécifique ;
    // c'est le 2e bouton du form (le 1er = submit).
    const dismissBtn = form.locator('button[type="button"]');
    await dismissBtn.click();

    // Étape 6 : nouvelle offre `negotiation` doit apparaître.
    const newOffer = page.getByTestId('chat-lead-offer');
    await expect(newOffer).toBeVisible({ timeout: 5_000 });
    await expect(newOffer).toHaveAttribute('data-reason', 'negotiation');
  });
});

// =============================================================================
// SUITE 6 — Anti-régression : faux-positifs (pas d'offer si reason absent)
// =============================================================================

test.describe('CHA-231 — pas de form si serveur n\'émet pas lead-form-offer', () => {
  test.setTimeout(20_000);

  test("SSE sans lead-form-offer + lead-status vide → pas de form", async ({ page }) => {
    await installBaseMocks(page);
    await mockMessageOnce(
      page,
      buildMessageStream({
        messageId: 'm_no_offer',
        // pas de leadOffer → comportement par défaut (greeting)
      }),
    );
    await page.goto('/');
    await sendMessage(page, 'Bonjour');

    // Wait for the assistant message to appear (stream is processed).
    await expect(page.getByTestId('chat-message-list')).toBeVisible();
    await page.waitForTimeout(2000);

    // Aucune offre.
    await expect(page.getByTestId('chat-lead-offer')).toHaveCount(0);
    await expect(page.getByTestId('chat-lead-form')).toHaveCount(0);
  });
});
