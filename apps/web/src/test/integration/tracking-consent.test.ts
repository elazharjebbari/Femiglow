/**
 * Suite d'intégration — POST /api/track/consent.
 * Couvre persistance, dedup par stateHash et validation.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { POST } from '@/app/api/track/consent/route';
import { memoryStore, resetMemoryStore } from '@/lib/db/client';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  resetMemoryStore();
});

const STATE_GRANTED = {
  ad_storage: 'granted',
  analytics_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
  functional_storage: 'granted',
} as const;

function buildRequest(body: unknown) {
  return new Request('http://localhost/api/track/consent', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.20',
      'user-agent': 'Mozilla/5.0',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/track/consent', () => {
  it('accepte un snapshot de consent valide → 202 + id', async () => {
    const res = await POST(
      buildRequest({
        anonymous_id: 'aid_consent_1',
        state: STATE_GRANTED,
        source: 'banner',
      }),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toMatch(/^tcs_/);
    expect(memoryStore().trackingConsentSnapshots.size).toBe(1);
  });

  it('dedup par anonymous_id + stateHash : second appel renvoie le même id', async () => {
    const payload = {
      anonymous_id: 'aid_consent_2',
      state: STATE_GRANTED,
      source: 'banner' as const,
    };
    const r1 = await POST(buildRequest(payload));
    const r2 = await POST(buildRequest(payload));
    const b1 = await r1.json();
    const b2 = await r2.json();
    expect(b1.id).toBe(b2.id);
    expect(memoryStore().trackingConsentSnapshots.size).toBe(1);
  });

  it('400 sur payload invalide', async () => {
    const res = await POST(buildRequest({ anonymous_id: 'x', state: STATE_GRANTED }));
    expect(res.status).toBe(400);
  });

  it('persiste source + ipAnonymized + uaHash', async () => {
    await POST(
      buildRequest({
        anonymous_id: 'aid_consent_3',
        state: STATE_GRANTED,
        source: 'preferences',
      }),
    );
    const snapshot = Array.from(memoryStore().trackingConsentSnapshots.values())[0];
    expect(snapshot?.source).toBe('preferences');
    expect(snapshot?.ipAnonymized).toBe('203.0.113.0');
    expect(snapshot?.uaHash).toMatch(/^[0-9a-f]+$/);
  });
});
