import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import {
  gtmPokaYokeHandlers,
  resetGtmPokaYokeState,
  getGtmPokaYokeState,
} from './gtm-poka-yoke-handlers';
import { makeConfigFixture, makeMappingFixture, BUNDLE_ID } from '@/test/fixtures/gtm-poka-yoke/fixtures';

const server = setupServer(...gtmPokaYokeHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => resetGtmPokaYokeState());

/**
 * Tests robustes pour les routes Poka-Yoke (couche MSW).
 */

describe('POST /api/track/sentinel — robustesse', () => {
  const okOrigin = { 'content-type': 'application/json', origin: 'http://localhost' };

  it('rejette POST sans content-type JSON encore valide payload', async () => {
    const res = await fetch('/api/track/sentinel', {
      method: 'POST',
      headers: { 'content-type': 'text/plain', origin: 'http://localhost' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('rejette payload null', async () => {
    const res = await fetch('/api/track/sentinel', { method: 'POST', headers: okOrigin, body: 'null' });
    expect(res.status).toBe(400);
  });

  it('rejette payload contenant un champ extra (strict)', async () => {
    const res = await fetch('/api/track/sentinel', {
      method: 'POST',
      headers: okOrigin,
      body: JSON.stringify({
        bundleId: 'a7c4f2e9b81d',
        mappingVersion: 'v17',
        configVersion: 'v4',
        containerId: 'GTM-ABCD',
        sentAt: new Date().toISOString(),
        extra_payload: 'malicious',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejette bundleId uppercase', async () => {
    const res = await fetch('/api/track/sentinel', {
      method: 'POST',
      headers: okOrigin,
      body: JSON.stringify({
        bundleId: 'A7C4F2E9B81D',
        mappingVersion: 'v17',
        configVersion: 'v4',
        containerId: 'GTM-ABCD',
        sentAt: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejette containerId mal formé', async () => {
    const res = await fetch('/api/track/sentinel', {
      method: 'POST',
      headers: okOrigin,
      body: JSON.stringify({
        bundleId: 'a7c4f2e9b81d',
        mappingVersion: 'v17',
        configVersion: 'v4',
        containerId: 'NOT-A-GTM-ID',
        sentAt: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(400);
  });

  it('séquence 10 pings cohérents → state reste ok', async () => {
    for (let i = 0; i < 10; i++) {
      await fetch('/api/track/sentinel', {
        method: 'POST',
        headers: okOrigin,
        body: JSON.stringify({
          bundleId: 'a7c4f2e9b81d',
          mappingVersion: 'v17',
          configVersion: 'v4',
          containerId: 'GTM-ABCD',
          sentAt: new Date().toISOString(),
        }),
      });
    }
    const state = getGtmPokaYokeState();
    expect(state.pings.length).toBe(10);
    expect(state.drift.status).toBe('ok');
  });

  it('1 ping en drift après 5 pings ok → state bascule critical', async () => {
    for (let i = 0; i < 5; i++) {
      await fetch('/api/track/sentinel', {
        method: 'POST',
        headers: okOrigin,
        body: JSON.stringify({
          bundleId: 'a7c4f2e9b81d',
          mappingVersion: 'v17',
          configVersion: 'v4',
          containerId: 'GTM-ABCD',
          sentAt: new Date().toISOString(),
        }),
      });
    }
    expect(getGtmPokaYokeState().drift.status).toBe('ok');
    await fetch('/api/track/sentinel', {
      method: 'POST',
      headers: okOrigin,
      body: JSON.stringify({
        bundleId: 'a7c4f2e9b81d',
        mappingVersion: 'v16', // drift !
        configVersion: 'v4',
        containerId: 'GTM-ABCD',
        sentAt: new Date().toISOString(),
      }),
    });
    expect(getGtmPokaYokeState().drift.status).toBe('critical');
  });

  it('rejette origin manquant', async () => {
    const res = await fetch('/api/track/sentinel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it('rejette origin externe', async () => {
    const res = await fetch('/api/track/sentinel', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it('manifestMismatch:true est persisté correctement', async () => {
    await fetch('/api/track/sentinel', {
      method: 'POST',
      headers: okOrigin,
      body: JSON.stringify({
        bundleId: 'a7c4f2e9b81d',
        mappingVersion: 'v17',
        configVersion: 'v4',
        containerId: 'GTM-ABCD',
        sentAt: new Date().toISOString(),
        manifestMismatch: true,
        manifestMismatchDetails: 'config=undefined,mapping=abc',
      }),
    });
    const ping = getGtmPokaYokeState().pings[0]!;
    expect(ping.manifestMismatch).toBe(true);
    expect(ping.manifestMismatchDetails).toBe('config=undefined,mapping=abc');
    expect(getGtmPokaYokeState().drift.status).toBe('critical');
  });
});

describe('POST /api/admin/tracking/gtm/validate-pair — robustesse', () => {
  const headers = { 'content-type': 'application/json' };

  it('refuse un payload sans configJson', async () => {
    const res = await fetch('/api/admin/tracking/gtm/validate-pair', {
      method: 'POST',
      headers,
      body: JSON.stringify({ mappingJson: {} }),
    });
    expect(res.status).toBe(400);
  });

  it('refuse un payload sans mappingJson', async () => {
    const res = await fetch('/api/admin/tracking/gtm/validate-pair', {
      method: 'POST',
      headers,
      body: JSON.stringify({ configJson: {} }),
    });
    expect(res.status).toBe(400);
  });

  it('refuse un payload avec champ extra', async () => {
    const res = await fetch('/api/admin/tracking/gtm/validate-pair', {
      method: 'POST',
      headers,
      body: JSON.stringify({ configJson: {}, mappingJson: {}, extra: 'oops' }),
    });
    expect(res.status).toBe(400);
  });

  it('renvoie un verdict OK pour la paire canonique fixture', async () => {
    const res = await fetch('/api/admin/tracking/gtm/validate-pair', {
      method: 'POST',
      headers,
      body: JSON.stringify({ configJson: makeConfigFixture(), mappingJson: makeMappingFixture() }),
    });
    const json = (await res.json()) as { ok: boolean; bundleId: { match: boolean } };
    expect(json.ok).toBe(true);
    expect(json.bundleId.match).toBe(true);
  });

  it('détecte container_id_mismatch', async () => {
    const mapping = makeMappingFixture({ containerId: 'GTM-OTHER' });
    mapping.manifest.bundleId = BUNDLE_ID;
    const res = await fetch('/api/admin/tracking/gtm/validate-pair', {
      method: 'POST',
      headers,
      body: JSON.stringify({ configJson: makeConfigFixture(), mappingJson: mapping }),
    });
    const json = (await res.json()) as { ok: boolean; errors: Array<{ code: string }> };
    expect(json.ok).toBe(false);
    expect(json.errors.some((e) => e.code === 'container_id_mismatch')).toBe(true);
  });

  it('reste rapide sur paires de 200 events', async () => {
    const mapping = makeMappingFixture();
    for (let i = 0; i < 200; i++) {
      (mapping.mappings as Record<string, unknown>)[`e${i}`] = { meta: { eventName: `E${i}` } };
    }
    const t = Date.now();
    const res = await fetch('/api/admin/tracking/gtm/validate-pair', {
      method: 'POST',
      headers,
      body: JSON.stringify({ configJson: makeConfigFixture(), mappingJson: mapping }),
    });
    expect(Date.now() - t).toBeLessThan(2000);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/admin/tracking/gtm/sync-status — robustesse', () => {
  it('payload retourné a la structure attendue', async () => {
    const res = await fetch('/api/admin/tracking/gtm/sync-status');
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toHaveProperty('activeAdmin');
    expect(json).toHaveProperty('lastPing');
    expect(json).toHaveProperty('drift');
    expect(json).toHaveProperty('silence');
    expect(json).toHaveProperty('history');
    expect(json).toHaveProperty('recentTransitions');
    expect(json).toHaveProperty('generatedAt');
  });

  it('reflète l\'état après ingestion de pings', async () => {
    await fetch('/api/track/sentinel', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({
        bundleId: 'a7c4f2e9b81d',
        mappingVersion: 'v17',
        configVersion: 'v4',
        containerId: 'GTM-ABCD',
        sentAt: new Date().toISOString(),
      }),
    });
    const res = await fetch('/api/admin/tracking/gtm/sync-status');
    const json = (await res.json()) as { lastPing: unknown; drift: { status: string } };
    expect(json.lastPing).not.toBeNull();
    expect(json.drift.status).toBe('ok');
  });

  it('drift transitions reflétées sur appels successifs', async () => {
    const okOrigin = { 'content-type': 'application/json', origin: 'http://localhost' };
    await fetch('/api/track/sentinel', {
      method: 'POST',
      headers: okOrigin,
      body: JSON.stringify({
        bundleId: 'a7c4f2e9b81d',
        mappingVersion: 'v17',
        configVersion: 'v4',
        containerId: 'GTM-ABCD',
        sentAt: new Date().toISOString(),
      }),
    });
    let res = await fetch('/api/admin/tracking/gtm/sync-status');
    let json = (await res.json()) as { drift: { status: string } };
    expect(json.drift.status).toBe('ok');

    await fetch('/api/track/sentinel', {
      method: 'POST',
      headers: okOrigin,
      body: JSON.stringify({
        bundleId: 'a7c4f2e9b81d',
        mappingVersion: 'v16',
        configVersion: 'v4',
        containerId: 'GTM-ABCD',
        sentAt: new Date().toISOString(),
      }),
    });
    res = await fetch('/api/admin/tracking/gtm/sync-status');
    json = (await res.json()) as { drift: { status: string } };
    expect(json.drift.status).toBe('critical');
  });
});
