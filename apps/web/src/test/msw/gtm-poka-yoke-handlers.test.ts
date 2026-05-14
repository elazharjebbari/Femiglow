import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import {
  gtmPokaYokeHandlers,
  resetGtmPokaYokeState,
  getGtmPokaYokeState,
} from './gtm-poka-yoke-handlers';
import { computeBundleId } from '@/lib/tracking/gtm/bundle-id';

const server = setupServer(...gtmPokaYokeHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => resetGtmPokaYokeState());

const baseBundleInput = {
  mappingVersion: 'v17',
  configVersion: 'v4',
  containerId: 'GTM-ABCD',
  events: [{ name: 'purchase', resolvedNames: { meta: 'Purchase' } }],
  generatedAt: '2026-05-13T19:30:00.000Z',
};

describe('POST /api/track/sentinel', () => {
  const baseUrl = '';

  it('accepte un payload valide → 204 + INSERT en state', async () => {
    const bundleId = computeBundleId(baseBundleInput);
    resetGtmPokaYokeState({
      admin: { mappingVersion: 'v17', configVersion: 'v4', bundleId, containerId: 'GTM-ABCD' },
    });
    const res = await fetch(`${baseUrl}/api/track/sentinel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({
        bundleId,
        mappingVersion: 'v17',
        configVersion: 'v4',
        containerId: 'GTM-ABCD',
        sentAt: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(204);
    expect(getGtmPokaYokeState().pings.length).toBe(1);
  });

  it('rejette payload invalide → 400', async () => {
    const res = await fetch(`${baseUrl}/api/track/sentinel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ bundleId: 'short' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejette origin non-allowlist → 403', async () => {
    const res = await fetch(`${baseUrl}/api/track/sentinel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({
        bundleId: 'a7c4f2e9b81d',
        mappingVersion: 'v17',
        configVersion: 'v4',
        containerId: 'GTM-ABCD',
        sentAt: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(403);
  });

  it('met à jour le drift state au reçu d\'un ping en drift', async () => {
    const bundleId = computeBundleId(baseBundleInput);
    resetGtmPokaYokeState({
      admin: { mappingVersion: 'v17', configVersion: 'v4', bundleId, containerId: 'GTM-ABCD' },
    });
    await fetch(`${baseUrl}/api/track/sentinel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({
        bundleId,
        mappingVersion: 'v16',
        configVersion: 'v4',
        containerId: 'GTM-ABCD',
        sentAt: new Date().toISOString(),
      }),
    });
    expect(getGtmPokaYokeState().drift.status).toBe('critical');
  });
});

describe('POST /api/admin/tracking/gtm/validate-pair', () => {
  const baseUrl = '';

  it('valide une paire cohérente → ok: true', async () => {
    const bundleId = computeBundleId(baseBundleInput);
    const config = {
      containerVersion: {
        container: { publicId: 'GTM-ABCD' },
        variable: [
          { name: 'FG Bundle Id', parameter: [{ key: 'value', value: bundleId }] },
          { name: 'FG Config Version', parameter: [{ key: 'value', value: 'v4' }] },
        ],
        trigger: [],
      },
    };
    const mapping = {
      manifest: {
        schemaVersion: 'fg-mapping/2.0',
        bundleId,
        mappingVersion: 'v17',
        requiredConfigVersion: 'v4',
        containerId: 'GTM-ABCD',
      },
      mappings: {},
    };
    const res = await fetch(`${baseUrl}/api/admin/tracking/gtm/validate-pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ configJson: config, mappingJson: mapping }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it('détecte un bundle mismatch', async () => {
    const config = {
      containerVersion: {
        container: { publicId: 'GTM-ABCD' },
        variable: [{ name: 'FG Bundle Id', parameter: [{ key: 'value', value: 'a7c4f2e9b81d' }] }],
      },
    };
    const mapping = {
      manifest: {
        schemaVersion: 'fg-mapping/2.0',
        bundleId: 'bbbbbbbbbbbb',
        mappingVersion: 'v17',
        requiredConfigVersion: 'v4',
        containerId: 'GTM-ABCD',
      },
      mappings: {},
    };
    const res = await fetch(`${baseUrl}/api/admin/tracking/gtm/validate-pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ configJson: config, mappingJson: mapping }),
    });
    const json = (await res.json()) as { ok: boolean; errors: Array<{ code: string }> };
    expect(json.ok).toBe(false);
    expect(json.errors.some((e) => e.code === 'bundle_mismatch')).toBe(true);
  });
});

describe('GET /api/admin/tracking/gtm/sync-status', () => {
  const baseUrl = '';

  it('renvoie un payload complet sans ping', async () => {
    const res = await fetch(`${baseUrl}/api/admin/tracking/gtm/sync-status`);
    const json = (await res.json()) as { drift: { status: string }; lastPing: unknown };
    expect(json.drift.status).toBe('ok');
    expect(json.lastPing).toBeNull();
  });
});
