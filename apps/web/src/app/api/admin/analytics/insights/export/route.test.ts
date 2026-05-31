import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMemoryStore, memoryStore } from '@/lib/db/client';
import { createId } from '@/lib/ids';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { GET } from './route';
import { runInsightsRefresh } from '@/lib/analytics/insights/refresh';

const NOW = new Date('2026-05-08T12:00:00Z');
const BOM = '﻿';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  resetMemoryStore();
  vi.mocked(getAdminSession).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

function adminSession() {
  return { adminId: 'adm_1', email: 'a@b.c', issuedAt: 0, expiresAt: 0 } as never;
}

async function seedAndRefresh() {
  for (let i = 0; i < 3; i++) {
    const id = createId('evt');
    memoryStore().trackingEventsLog.set(id, {
      id,
      eventId: id,
      eventName: 'page_view',
      eventCategory: 'page',
      pageId: null,
      componentId: null,
      pageRoute: i === 0 ? '/' : '/kit',
      anonymousId: 'a',
      sessionId: `sess_${i}`,
      userId: null,
      consentSnapshot: { analytics: true } as never,
      payload: {},
      uaHash: 'h',
      ipAnonymized: '0.0.0.0',
      device: 'mobile',
      locale: 'fr-MA',
      isConversion: false,
      providersDispatched: [],
      providersResults: {},
      receivedAt: NOW,
      schemaVersion: 1,
      trafficSource: null,
      trafficMedium: null,
      experimentId: null,
      experimentVariant: null,
    });
  }
  await runInsightsRefresh({ trigger: 'manual', actorId: null });
}

describe('GET /api/admin/analytics/insights/export', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await GET(new Request('http://x/api/admin/analytics/insights/export?view=pages'));
    expect(res.status).toBe(401);
  });

  it('400 si view invalide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET(new Request('http://x/api/admin/analytics/insights/export?view=foo'));
    expect(res.status).toBe(400);
  });

  it('CSV pages avec BOM UTF-8 + Content-Disposition', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await seedAndRefresh();
    const res = await GET(new Request('http://x/api/admin/analytics/insights/export?view=pages'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/csv/);
    expect(res.headers.get('content-disposition')).toMatch(/attachment.*\.csv/);
    const buf = new Uint8Array(await res.arrayBuffer());
    // BOM UTF-8 = EF BB BF
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);
    const text = new TextDecoder('utf-8').decode(buf);
    expect(text).toContain('page_route');
  });

  it('view=overview produit timeseries', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await seedAndRefresh();
    const res = await GET(new Request('http://x/api/admin/analytics/insights/export?view=overview'));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('date,events,sessions,conversions');
  });

  it('view=funnel valide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await seedAndRefresh();
    const res = await GET(new Request('http://x/api/admin/analytics/insights/export?view=funnel'));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('stage');
  });
});
