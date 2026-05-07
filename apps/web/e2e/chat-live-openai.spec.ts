/**
 * Test LIVE OpenAI — un seul appel réel, minimal en tokens.
 *
 * BUT : valider que l'intégralité du pipeline (widget → /api/chat/session
 * → /api/chat/message → orchestrator → adapter OpenAI → SSE → widget)
 * fonctionne avec une vraie clé.
 *
 * COÛT : 1 appel `gpt-4o-mini` avec `max_tokens: 8` ≈ 0,00002 USD. Le
 * test envoie un prompt qui force une réponse d'un seul mot ("OK").
 *
 * Prérequis :
 *  - Un provider OpenAI ACTIF en base, avec rôle `chat`. Voir le
 *    fixture `e2e.setup.ts` (utilise le seed admin) ou créer
 *    manuellement via /admin/chat/providers/new.
 *  - Variable d'env `OPENAI_LIVE_TEST=1` pour activer (sinon skip).
 *  - Variable `PLAYWRIGHT_BASE_URL` (défaut http://127.0.0.1:3000).
 *
 * Pour lancer :
 *
 *   OPENAI_LIVE_TEST=1 PLAYWRIGHT_BASE_URL=http://localhost:3001 \
 *     pnpm exec playwright test chat-live-openai.spec.ts
 */
import { expect, test } from '@playwright/test';

const SHOULD_RUN = process.env.OPENAI_LIVE_TEST === '1';

test.describe('Chat LIVE OpenAI — bout en bout (1 appel réel)', () => {
  test.skip(!SHOULD_RUN, 'OPENAI_LIVE_TEST=1 requis pour lancer ce test live.');

  // Ce test peut prendre jusqu'à 60s en cas de cold-start.
  test.setTimeout(60_000);

  test('un message court → réponse non vide streamée', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('chat-launcher').click();

    const composer = page.getByPlaceholder(/message|écrivez|tapez/i);
    await expect(composer).toBeVisible();

    // Prompt minimal : on demande explicitement « réponds OK » pour
    // contraindre la réponse à 1-2 tokens. La voix FemiGlow autorise
    // les réponses très brèves quand l'utilisateur le demande.
    const prompt = "Réponds simplement par 'OK' (un seul mot).";
    await composer.fill(prompt);
    await composer.press('Enter');

    // Le message user apparaît immédiatement.
    await expect(page.getByText(prompt, { exact: false })).toBeVisible();

    // Attend qu'un message assistant non vide apparaisse dans le log.
    // On accepte tout texte : la réponse peut être "OK", "OK.", "Ok",
    // ou même un fallback en cas de policy interne — l'important est
    // qu'un texte non-vide arrive du backend.
    const messages = page.locator('[data-role="messages"]');
    await expect(messages).toBeVisible({ timeout: 15_000 });

    // Compte le nombre de bulles avant et après pour confirmer qu'une
    // bulle assistant a bien été ajoutée (en plus de celle du user).
    await page.waitForFunction(
      () => {
        const list = document.querySelector('[data-role="messages"]');
        if (!list) return false;
        const bubbles = list.querySelectorAll('[data-message-role]');
        const assistantBubbles = Array.from(bubbles).filter(
          (b) => b.getAttribute('data-message-role') === 'assistant',
        );
        // Au moins 1 bulle assistant avec du texte.
        return assistantBubbles.some((b) => (b.textContent ?? '').trim().length > 0);
      },
      undefined,
      { timeout: 30_000, polling: 500 },
    );
  });

  test('GET /api/chat/session retourne 200 + sessionId', async ({ request }) => {
    const res = await request.get('/api/chat/session');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { sessionId: string };
    expect(body.sessionId).toMatch(/^cs_/);
  });

  test('POST /api/chat/message stream SSE valide', async ({ request }) => {
    // 1. Crée une session
    const sessRes = await request.get('/api/chat/session');
    const { sessionId } = (await sessRes.json()) as { sessionId: string };

    // 2. Envoie un message minimal et lit le stream brut pour valider
    //    le format SSE.
    const res = await request.post('/api/chat/message', {
      data: { sessionId, text: "Réponds 'OK' (un mot)." },
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      timeout: 60_000,
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/event-stream');

    const text = await res.text();
    // Le stream doit contenir au moins un évent `start` et un évent `end`.
    expect(text).toMatch(/event:\s*start/);
    expect(text).toMatch(/event:\s*(end|error)/);
    // Le body doit contenir au moins un chunk avec un delta non vide.
    expect(text).toMatch(/event:\s*chunk[\s\S]+"delta"\s*:\s*"[^"]+"/);
  });
});
