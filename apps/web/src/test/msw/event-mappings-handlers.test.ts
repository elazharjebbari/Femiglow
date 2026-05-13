/**
 * Sanity tests pour event-mappings-handlers MSW.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { eventMappingsHandlers, resetMappingState, getMappingState } from './event-mappings-handlers';
import type { MappingVersion } from '@/lib/tracking/mappings/types';

const server = setupServer(...eventMappingsHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

const buildDefault = (): MappingVersion => ({
  id: '__default__',
  name: 'Default',
  notes: null,
  status: 'archived',
  isActive: false,
  isDefault: true,
  mappings: {
    purchase: {
      meta: { mappedName: 'Purchase', isCustom: false, isEnabled: true, notes: null },
      google_ga4: { mappedName: 'purchase', isCustom: false, isEnabled: true, notes: null },
      google_ads: { mappedName: 'purchase', isCustom: false, isEnabled: true, notes: null },
      tiktok: { mappedName: 'CompletePayment', isCustom: false, isEnabled: true, notes: null },
      snap: { mappedName: 'PURCHASE', isCustom: false, isEnabled: true, notes: null },
      pinterest: { mappedName: 'checkout', isCustom: false, isEnabled: true, notes: null },
    },
  },
  clonedFrom: null,
  createdBy: 'system',
  createdAt: new Date(),
  activatedAt: null,
  archivedAt: null,
  deletedAt: null,
});

beforeEach(() => resetMappingState([buildDefault()]));

describe('eventMappingsHandlers — sanity', () => {
  it('GET /list retourne __default__', async () => {
    const res = await fetch('/api/admin/tracking/events/mappings');
    expect(res.status).toBe(200);
    const data = (await res.json()) as { versions: Array<{ id: string }>; defaultId: string };
    expect(data.defaultId).toBe('__default__');
    expect(data.versions).toHaveLength(1);
  });

  it('GET /:id retourne 404 pour id inconnu', async () => {
    const res = await fetch('/api/admin/tracking/events/mappings/nope');
    expect(res.status).toBe(404);
  });

  it('POST create kind=clone fonctionne', async () => {
    const res = await fetch('/api/admin/tracking/events/mappings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'v1 — clone', source: { kind: 'clone', sourceId: '__default__' } }),
    });
    expect(res.status).toBe(201);
    const v = (await res.json()) as { id: string; clonedFrom: string; status: string };
    expect(v.clonedFrom).toBe('__default__');
    expect(v.status).toBe('draft');
    expect(getMappingState().versions.size).toBe(2);
  });

  it('PUT /:__default__ → 403 cannot_edit_default', async () => {
    const res = await fetch('/api/admin/tracking/events/mappings/__default__', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mappings: {} }),
    });
    expect(res.status).toBe(403);
  });

  it('POST activate → version devient active + ancienne archivée', async () => {
    // Crée une draft
    const cr = await fetch('/api/admin/tracking/events/mappings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'v1', source: { kind: 'clone', sourceId: '__default__' } }),
    });
    const { id } = (await cr.json()) as { id: string };
    // Active la draft
    const res = await fetch(`/api/admin/tracking/events/mappings/${id}/activate`, { method: 'POST' });
    expect(res.status).toBe(200);
    const v = (await res.json()) as { isActive: boolean; status: string };
    expect(v.isActive).toBe(true);
    expect(v.status).toBe('active');
    expect(getMappingState().activeId).toBe(id);
  });

  it('DELETE __default__ → 403', async () => {
    const res = await fetch('/api/admin/tracking/events/mappings/__default__', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  it('POST test dispatch retourne 6 résultats provider', async () => {
    const res = await fetch('/api/admin/tracking/events/mappings/__default__/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventName: 'purchase' }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { results: Record<string, { wouldDispatch: boolean; mappedName: string | null }> };
    expect(Object.keys(data.results)).toHaveLength(6);
    expect(data.results.meta!.mappedName).toBe('Purchase');
  });

  it('POST export-gtm retourne containerJson + meta', async () => {
    const res = await fetch('/api/admin/tracking/events/mappings/__default__/export-gtm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ env: 'production' }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { containerJson: { exportFormatVersion: number }; meta: { sha256: string } };
    expect(data.containerJson.exportFormatVersion).toBe(2);
    expect(data.meta.sha256).toBe('mock_sha256');
  });

  it('POST reset-default → __default__ devient active', async () => {
    const res = await fetch('/api/admin/tracking/events/mappings/reset-default', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(getMappingState().activeId).toBe('__default__');
  });

  it('resetMappingState vide tout', async () => {
    resetMappingState([]);
    const res = await fetch('/api/admin/tracking/events/mappings');
    const data = (await res.json()) as { versions: unknown[] };
    expect(data.versions).toHaveLength(0);
  });
});
