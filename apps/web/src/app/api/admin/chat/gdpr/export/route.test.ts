/**
 * Tests `GET /api/admin/chat/gdpr/export`.
 *
 * On valide :
 *  - 401 si non admin
 *  - 400 si sessionId + visitorId fournis (ou aucun)
 *  - 400 si sessionId mal formé
 *  - 400 si visitorId mal formé
 *  - 404 si sessionId inexistant
 *  - 200 + session/messages/leads quand sessionId OK
 *  - 200 + sessions[] quand visitorId OK
 *  - Content-Disposition + Cache-Control: no-store
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/chat/admin/auth', () => ({
  requireAdminApi: vi.fn(),
}));

vi.mock('@/lib/chat/repos/session', () => ({
  sessionRepo: {
    getById: vi.fn(),
    listByVisitor: vi.fn(),
  },
}));

vi.mock('@/lib/chat/repos/message', () => ({
  messageRepo: {
    listBySession: vi.fn(),
  },
}));

vi.mock('@/lib/chat/repos/lead', () => ({
  leadRepo: {
    listBySession: vi.fn(),
  },
}));

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { leadRepo } from '@/lib/chat/repos/lead';
import { messageRepo } from '@/lib/chat/repos/message';
import { sessionRepo } from '@/lib/chat/repos/session';
import { GET } from './route';

const requireAdminMock = requireAdminApi as unknown as ReturnType<typeof vi.fn>;
const getByIdMock = sessionRepo.getById as unknown as ReturnType<typeof vi.fn>;
const listByVisitorMock = sessionRepo.listByVisitor as unknown as ReturnType<typeof vi.fn>;
const listMessagesMock = messageRepo.listBySession as unknown as ReturnType<typeof vi.fn>;
const listLeadsMock = leadRepo.listBySession as unknown as ReturnType<typeof vi.fn>;

function buildReq(qs = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/chat/gdpr/export${qs}`);
}

function sessionRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'cs_abc',
    visitorId: 'visitor-1',
    status: 'open',
    language: 'fr',
    page: '/',
    referrer: null,
    instructionVersionId: 'iv_1',
    openedAt: new Date(),
    lastSeenAt: new Date(),
    archivedAt: null,
    purgedAt: null,
    ...over,
  };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/admin/chat/gdpr/export', () => {
  it('renvoie 401 si non admin', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: new Response('unauthorized', { status: 401 }),
    });
    const res = await GET(buildReq());
    expect(res.status).toBe(401);
  });

  it('renvoie 400 quand ni sessionId ni visitorId', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    const res = await GET(buildReq());
    expect(res.status).toBe(400);
  });

  it('renvoie 400 quand sessionId ET visitorId', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    const res = await GET(buildReq('?sessionId=cs_abc&visitorId=visitor-1'));
    expect(res.status).toBe(400);
  });

  it('renvoie 400 si sessionId mal formé', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    const res = await GET(buildReq('?sessionId=not-good'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid-session-id');
  });

  it('renvoie 400 si visitorId mal formé', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    const res = await GET(buildReq('?visitorId=x'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid-visitor-id');
  });

  it('renvoie 404 si sessionId inexistant', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    getByIdMock.mockResolvedValueOnce(null);
    const res = await GET(buildReq('?sessionId=cs_abc'));
    expect(res.status).toBe(404);
  });

  it('renvoie 200 + session/messages/leads quand sessionId OK', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    getByIdMock.mockResolvedValueOnce(sessionRow());
    listMessagesMock.mockResolvedValueOnce([
      { id: 'cm_1', role: 'user', content: 'hi' },
    ]);
    listLeadsMock.mockResolvedValueOnce([]);
    const res = await GET(buildReq('?sessionId=cs_abc'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Content-Disposition')).toContain('chat-gdpr-cs_abc.json');
    const body = (await res.json()) as {
      mode: string;
      session: { id: string };
      messages: Array<unknown>;
    };
    expect(body.mode).toBe('session');
    expect(body.session.id).toBe('cs_abc');
    expect(body.messages).toHaveLength(1);
  });

  it('renvoie 200 + sessions[] quand visitorId OK', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    listByVisitorMock.mockResolvedValueOnce([
      sessionRow({ id: 'cs_1' }),
      sessionRow({ id: 'cs_2', status: 'purged' }),
    ]);
    listMessagesMock.mockResolvedValue([]);
    listLeadsMock.mockResolvedValue([]);
    const res = await GET(buildReq('?visitorId=visitor-1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toContain('chat-gdpr-visitor-visitor-1.json');
    const body = (await res.json()) as {
      mode: string;
      sessionsCount: number;
      sessions: Array<{ session: { id: string } }>;
    };
    expect(body.mode).toBe('visitor');
    expect(body.sessionsCount).toBe(2);
    expect(body.sessions[0]?.session.id).toBe('cs_1');
  });
});
