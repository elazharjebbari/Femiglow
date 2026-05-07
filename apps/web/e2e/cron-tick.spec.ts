import { test, expect } from '@playwright/test';

/**
 * E2E — endpoint cron, accessible uniquement avec bearer.
 * Note : le bearer attendu par /api/cron/tick est `process.env.CRON_SECRET`
 * (côté serveur Vercel). En CI on utilise la valeur fournie par le job.
 */
test.describe('POST /api/cron/tick', () => {
  test('refuse 401 sans bearer', async ({ request }) => {
    const res = await request.post('/api/cron/tick');
    expect(res.status()).toBe(401);
  });

  test('refuse 401 avec bearer invalide', async ({ request }) => {
    const res = await request.post('/api/cron/tick', {
      headers: { authorization: 'Bearer invalid-secret' },
    });
    expect(res.status()).toBe(401);
  });
});
