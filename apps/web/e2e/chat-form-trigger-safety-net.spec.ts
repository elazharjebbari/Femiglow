import { expect, test } from '@playwright/test';

function sseBody(events: string[]): string {
  return events.join('');
}

test.describe('chat form trigger safety net', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/chat/session**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: 'cs_e2e_safety',
          language: 'fr',
          status: 'open',
          greeting: '',
          suggestions: [],
          messages: [],
          themeVariantId: 'default',
          variantOpaqueId: 'default',
        }),
      });
    });
  });

  async function openChat(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as { __chatStore?: unknown }).__chatStore));
    await page.evaluate(() => {
      const store = (window as unknown as {
        __chatStore: { getState: () => { open: () => void } };
      }).__chatStore;
      store.getState().open();
    });
    await expect(page.getByTestId('chat-input')).toBeVisible();
  }

  test("ouvre l'offre formulaire si l'assistant le promet sans event SSE lead-form-offer", async ({
    page,
  }) => {
    await page.route('**/api/chat/message', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseBody([
          'event: start\ndata: {"messageId":"cm_safety_1","language":"fr"}\n\n',
          'event: chunk\ndata: {"messageId":"cm_safety_1","delta":"Je vous affiche le formulaire juste ici."}\n\n',
          'event: end\ndata: {"messageId":"cm_safety_1","latencyMs":120}\n\n',
        ]),
      });
    });

    await openChat(page);
    const composer = page.getByTestId('chat-input');
    await composer.fill('je veux etre rappelee');
    await composer.press('Enter');

    const offers = page.getByTestId('chat-lead-offer');
    await expect(offers).toHaveCount(1);
    await expect(offers.first()).toHaveAttribute('data-reason', 'manual');

    await page.getByTestId('chat-lead-cta').click();
    await expect(page.getByTestId('chat-lead-form')).toBeVisible();
  });

  test("ne duplique pas l'offre si le fallback client et le SSE ciblent le meme message", async ({
    page,
  }) => {
    await page.route('**/api/chat/message', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseBody([
          'event: start\ndata: {"messageId":"cm_safety_2","language":"fr"}\n\n',
          'event: chunk\ndata: {"messageId":"cm_safety_2","delta":"Je vous affiche le formulaire juste ici."}\n\n',
          'event: end\ndata: {"messageId":"cm_safety_2","latencyMs":120}\n\n',
          'event: lead-form-offer\ndata: {"messageId":"cm_safety_2","reason":"purchase-intent","copyKey":"purchase-intent"}\n\n',
        ]),
      });
    });

    await openChat(page);
    const composer = page.getByTestId('chat-input');
    await composer.fill('je veux commander');
    await composer.press('Enter');

    await expect(page.getByTestId('chat-lead-offer')).toHaveCount(1);
  });
});
