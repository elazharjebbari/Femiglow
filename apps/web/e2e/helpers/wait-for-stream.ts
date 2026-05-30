/**
 * Helpers Playwright pour attendre la fin d'un stream SSE chat.
 *
 * Anti-flakiness : pas de `waitForTimeout`. On attend des conditions
 * observables (DOM state, network response, store state).
 */
import { type Page } from '@playwright/test';

/**
 * Attend qu'un POST `/api/chat/message` se termine (response received).
 * Utile quand le stream se ferme rapidement et qu'on veut juste s'assurer
 * que la requête a été processée côté serveur.
 */
export async function waitForChatMessageResponse(
  page: Page,
  opts: { timeoutMs?: number } = {},
): Promise<void> {
  await page.waitForResponse(
    (r) => r.url().includes('/api/chat/message') && (r.status() === 200 || r.status() === 429),
    { timeout: opts.timeoutMs ?? 30_000 },
  );
}

/**
 * Attend que le store côté client signale `isSending=false`.
 *
 * Requiert que le code applicatif expose `window.__chatStoreState()`
 * en mode test (NEXT_PUBLIC_TEST_MODE=true).
 */
export async function waitForChatStreamComplete(
  page: Page,
  opts: { timeoutMs?: number } = {},
): Promise<void> {
  await page.waitForFunction(
    () => {
      const state = (window as unknown as { __chatStoreState?: () => { isSending?: boolean } })
        .__chatStoreState?.();
      return state?.isSending === false;
    },
    { timeout: opts.timeoutMs ?? 30_000 },
  );
}

/**
 * Poll générique avec predicate. Préférer aux `waitForTimeout` partout.
 */
export async function pollUntil<T>(
  fn: () => T | Promise<T>,
  predicate: (v: T) => boolean,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<T> {
  const interval = opts.intervalMs ?? 100;
  const timeout = opts.timeoutMs ?? 5_000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const v = await fn();
    if (predicate(v)) return v;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`pollUntil timeout (${timeout}ms)`);
}
