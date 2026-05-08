import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMemoryStore, memoryStore } from '@/lib/db/client';
import { createId } from '@/lib/ids';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { GET } from './route';
import { runInsightsRefresh } from '@/lib/analytics/insights/refresh';

const NOW = new Date('2026-05-08T12:00:00Z');

beforeEach(() => {
  resetMemoryStore();
  vi.mocked(getAdminSession).mockReset();
});

function adminSession() {
  return { adminId: 'adm_1', email: 'a@b.c', issuedAt: 0, expiresAt: 0 } as never;
}

async function seedKitPage() {
  const id = createId('evt');
  memoryStore().trackingEventsLog.set(id, {
    id,
    eventId: id,
    eventName: 'page_view',
    eventCategory: 'page',
    pageId: null,
    componentId: null,
    pageRoute: '/kit',
    anonymousId: 'a',
    sessionId: 's',
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
  await runInsightsRefresh({ trigger: 'manual', actorId: null });
}

describe('GET /api/admin/analytics/insights/pages/[route]', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await GET(
      new Request('http://x/api/admin/analytics/insights/pages/%2Fkit'),
      { params: { route: '%2Fkit' } },
    );
    expect(res.status).toBe(401);
  });

  it('404 sur route inexistante', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET(
      new Request('http://x/api/admin/analytics/insights/pages/%2Finexistant'),
      { params: { route: '%2Finexistant' } },
    );
    expect(res.status).toBe(404);
  });

  it('200 sur /kit après seed', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await seedKitPage();
    const res = await GET(
      new Request('http://x/api/admin/analytics/insights/pages/%2Fkit'),
      { params: { route: '%2Fkit' } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pageRoute: string; pageViews: number };
    expect(body.pageRoute).toBe('/kit');
    expect(body.pageViews).toBe(1);
  });

  it('audit log entry "drilldown.page" créée', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await seedKitPage();
    const before = memoryStore().auditEvents.size;
    await GET(
      new Request('http://x/api/admin/analytics/insights/pages/%2Fkit'),
      { params: { route: '%2Fkit' } },
    );
    const after = memoryStore().auditEvents.size;
    expect(after).toBeGreaterThan(before);
    const last = Array.from(memoryStore().auditEvents.values()).at(-1);
    expect(last?.action).toBe('analytics.insights.drilldown.page');
  });
});
