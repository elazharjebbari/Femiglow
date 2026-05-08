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

async function seedComponent() {
  const id = createId('evt');
  memoryStore().trackingEventsLog.set(id, {
    id,
    eventId: id,
    eventName: 'add_to_cart',
    eventCategory: 'ecommerce',
    pageId: null,
    componentId: 'cta-recevoir',
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

describe('GET /api/admin/analytics/insights/components/[id]', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await GET(
      new Request('http://x/api/admin/analytics/insights/components/cta-recevoir'),
      { params: { id: 'cta-recevoir' } },
    );
    expect(res.status).toBe(401);
  });

  it('404 si composant n\'a aucun event', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET(
      new Request('http://x/api/admin/analytics/insights/components/inexistant'),
      { params: { id: 'inexistant' } },
    );
    expect(res.status).toBe(404);
  });

  it('200 + payload détail après seed', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await seedComponent();
    const res = await GET(
      new Request('http://x/api/admin/analytics/insights/components/cta-recevoir'),
      { params: { id: 'cta-recevoir' } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      componentId: string;
      total: number;
      events: { eventName: string }[];
      pages: { pageRoute: string }[];
    };
    expect(body.componentId).toBe('cta-recevoir');
    expect(body.total).toBe(1);
    expect(body.events[0]?.eventName).toBe('add_to_cart');
    expect(body.pages[0]?.pageRoute).toBe('/kit');
  });

  it('audit log "drilldown.component"', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await seedComponent();
    await GET(
      new Request('http://x/api/admin/analytics/insights/components/cta-recevoir'),
      { params: { id: 'cta-recevoir' } },
    );
    const last = Array.from(memoryStore().auditEvents.values()).at(-1);
    expect(last?.action).toBe('analytics.insights.drilldown.component');
  });
});
