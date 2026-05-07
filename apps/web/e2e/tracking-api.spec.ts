import { test, expect } from '@playwright/test';

/**
 * E2E — API publique /api/track.
 * Vérifie que :
 *  - le endpoint accepte un payload conforme et répond 202
 *  - un payload mal formé retourne 4xx
 *  - GET non autorisé
 *
 * Le rate-limit / dedup est testé en unit ailleurs ; ici on vérifie
 * la robustesse du contrat HTTP visible côté frontend.
 */

const consent = {
  ad_storage: 'granted' as const,
  analytics_storage: 'granted' as const,
  ad_user_data: 'denied' as const,
  ad_personalization: 'denied' as const,
  functional_storage: 'granted' as const,
};

function buildEvent(name: string) {
  return {
    event: name,
    event_id: `evt_e2e_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    consent,
    page: {
      url: 'https://example.test/',
      path: '/',
      title: 'Home',
      referrer: '',
      locale: 'fr-FR',
    },
    user: {
      anonymous_id: '00000000-0000-7000-8000-000000000001',
      session_id: '00000000-0000-7000-8000-000000000002',
    },
    params: { title: 'Home' },
  };
}

test.describe('public /api/track contract', () => {
  test('payload conforme → 202', async ({ request }) => {
    const res = await request.post('/api/track', {
      data: { events: [buildEvent('page_view')] },
    });
    expect(res.status()).toBe(202);
    const json = (await res.json()) as { ok?: boolean; accepted?: number };
    expect(json.ok).toBe(true);
  });

  test('payload invalide → 4xx', async ({ request }) => {
    const res = await request.post('/api/track', {
      data: { events: 'not-an-array' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test('GET /api/track non autorisé', async ({ request }) => {
    const res = await request.get('/api/track');
    // Soit 405 (method not allowed) soit 404, jamais 200.
    expect([404, 405]).toContain(res.status());
  });
});
