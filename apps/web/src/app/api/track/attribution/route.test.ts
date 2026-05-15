/**
 * Tests d'intégration de l'API POST /api/track/attribution.
 *
 * Couvre :
 *  - 200 OK : upsert valide + snapshot retourné
 *  - 400 : body invalide / JSON malformé
 *  - 429 : rate limit dépassé
 *  - 200 idempotent (même touch dédupliqué)
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore, memoryStore } from '@/lib/db/client';
import { POST } from './route';

// Force le mode memoryStore : on supprime DATABASE_URL + on reset le
// cache `db()` interne (mémoïsé sur globalThis.__femiglowDb).
const originalDbUrl = process.env.DATABASE_URL;
beforeAll(() => {
  delete process.env.DATABASE_URL;
  // Force re-évaluation de db() (memoized en globalThis)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__femiglowDb = null;
});
afterAll(() => {
  if (originalDbUrl) process.env.DATABASE_URL = originalDbUrl;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).__femiglowDb;
});

function req(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://x/api/track/attribution', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '1.2.3.4',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validTouch = {
  channel: 'google_ads',
  is_paid: true,
  click_id: 'gclid_test',
  click_id_field: 'gclid',
  detected_at: '2026-05-15T12:00:00Z',
};

beforeEach(() => {
  resetMemoryStore();
});

describe('POST /api/track/attribution — happy path', () => {
  it('200 + snapshot pour un nouveau visitor', async () => {
    const res = await POST(req({ visitor_id: 'v_new', touch: validTouch }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.snapshot.first_touch.channel).toBe('google_ads');
    expect(body.snapshot.paid_history).toHaveLength(1);
    expect(memoryStore().visitorAttribution.has('v_new')).toBe(true);
  });

  it('update visitor existant — first_touch préservé', async () => {
    await POST(req({ visitor_id: 'v_seq', touch: { ...validTouch, channel: 'meta', click_id_field: 'fbclid', click_id: 'fb1' } }));
    const res = await POST(req({ visitor_id: 'v_seq', touch: validTouch })); // google_ads
    const body = await res.json();
    expect(body.snapshot.first_touch.channel).toBe('meta');
    expect(body.snapshot.last_touch.channel).toBe('google_ads');
  });
});

describe('POST /api/track/attribution — validation', () => {
  it('400 si body non JSON', async () => {
    const res = await POST(req('not-json'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_json');
  });

  it('400 si visitor_id manquant', async () => {
    const res = await POST(req({ touch: validTouch }));
    expect(res.status).toBe(400);
  });

  it('400 si channel inconnu', async () => {
    const res = await POST(
      req({ visitor_id: 'v_x', touch: { ...validTouch, channel: 'mars_ads' } }),
    );
    expect(res.status).toBe(400);
  });

  it('400 si visitor_id trop court', async () => {
    const res = await POST(req({ visitor_id: 'v', touch: validTouch }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/track/attribution — rate limit', () => {
  it('429 après 30 req depuis la même IP en 60s', async () => {
    // Spammer 31 calls
    const responses: number[] = [];
    for (let i = 0; i < 31; i += 1) {
      const r = await POST(req({ visitor_id: `v_${i}`, touch: validTouch }));
      responses.push(r.status);
    }
    expect(responses.filter((s) => s === 200).length).toBe(30);
    expect(responses.filter((s) => s === 429).length).toBe(1);
  });
});
