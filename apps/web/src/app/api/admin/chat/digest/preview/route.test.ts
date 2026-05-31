/**
 * CHAT-067 — Tests `GET /api/admin/chat/digest/preview`.
 *
 * On valide :
 *  - 401 si non admin
 *  - text/plain par défaut + body contient subject + lien admin
 *  - JSON quand format=json
 *  - days par défaut 7
 *  - days clampé à [1, 30]
 *  - days non numérique fallback 7
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/chat/admin/auth', () => ({
  requireAdminApi: vi.fn(),
}));

vi.mock('@/lib/chat/admin/queries', () => ({
  adminQueries: {
    listChatLeads: vi.fn(),
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SITE_URL: 'https://femiglow.local',
    CHAT_DIGEST_FROM: 'FemiGlow Chat <chat@femiglow.local>',
  },
}));

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { adminQueries } from '@/lib/chat/admin/queries';
import { GET } from './route';

const requireAdminMock = requireAdminApi as unknown as ReturnType<typeof vi.fn>;
const listMock = adminQueries.listChatLeads as unknown as ReturnType<typeof vi.fn>;

function buildReq(qs = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/chat/digest/preview${qs}`);
}

function lead(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'cl_1',
    sessionId: 'cs_1',
    firstName: 'Sara',
    phoneE164: '+212600000000',
    triggerReason: 'purchase-intent',
    outcome: 'pending',
    language: 'fr',
    page: '/produit',
    referrer: null,
    intentAtCapture: 'purchase-intent',
    webhookStatus: 'sent',
    webhookAttempts: 1,
    handledBy: null,
    consentVersion: 'v1',
    createdAt: new Date('2026-05-13T10:00:00Z'),
    ...over,
  };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/admin/chat/digest/preview', () => {
  it('renvoie 401 si non admin', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: new Response('unauthorized', { status: 401 }),
    });
    const res = await GET(buildReq());
    expect(res.status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('retourne text/plain par défaut, avec subject + lien admin', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    listMock.mockResolvedValueOnce([lead()]);
    const res = await GET(buildReq());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    const body = await res.text();
    expect(body).toContain('Subject:');
    expect(body).toContain('Digest hebdo chat');
    expect(body).toContain('https://femiglow.local/admin/chat/leads');
  });

  it('retourne JSON quand format=json', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    listMock.mockResolvedValueOnce([lead()]);
    const res = await GET(buildReq('?format=json'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      window: { days: number };
      summary: { total: number; hotPending: number };
      rendered: { subject: string };
    };
    expect(body.window.days).toBe(7);
    expect(body.summary.total).toBe(1);
    expect(body.summary.hotPending).toBe(1);
    expect(body.rendered.subject).toContain('hot pending');
  });

  it('utilise une fenêtre 7 jours par défaut', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    listMock.mockResolvedValueOnce([]);
    await GET(buildReq());
    const { fromDate, toDate } = listMock.mock.calls[0]![0] as {
      fromDate: Date;
      toDate: Date;
    };
    expect(toDate.getTime() - fromDate.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('clampe days à 30 max', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    listMock.mockResolvedValueOnce([]);
    await GET(buildReq('?days=999'));
    const { fromDate, toDate } = listMock.mock.calls[0]![0] as {
      fromDate: Date;
      toDate: Date;
    };
    expect(toDate.getTime() - fromDate.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('clampe days à 1 min', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    listMock.mockResolvedValueOnce([]);
    await GET(buildReq('?days=0'));
    const { fromDate, toDate } = listMock.mock.calls[0]![0] as {
      fromDate: Date;
      toDate: Date;
    };
    expect(toDate.getTime() - fromDate.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('fallback 7 si days non numérique', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    listMock.mockResolvedValueOnce([]);
    await GET(buildReq('?days=plop'));
    const { fromDate, toDate } = listMock.mock.calls[0]![0] as {
      fromDate: Date;
      toDate: Date;
    };
    expect(toDate.getTime() - fromDate.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
