/**
 * Tests `POST /api/admin/chat/gdpr/forget`.
 *
 * On valide :
 *  - 401 si non admin
 *  - 400 si JSON invalide
 *  - 400 si ni sessionId ni visitorId
 *  - 400 si les deux fournis
 *  - 404 si sessionId inexistant
 *  - 200 + alreadyPurged si la session est déjà purgée
 *  - 200 + purgedCount=1 quand session OK
 *  - 200 + purgedCount=N quand visitorId multi-sessions
 *  - 500 si sessionService.forget throw
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

vi.mock('@/lib/chat/services/session-service', () => ({
  sessionService: {
    forget: vi.fn(),
  },
}));

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { sessionRepo } from '@/lib/chat/repos/session';
import { sessionService } from '@/lib/chat/services/session-service';
import { POST } from './route';

const requireAdminMock = requireAdminApi as unknown as ReturnType<typeof vi.fn>;
const getByIdMock = sessionRepo.getById as unknown as ReturnType<typeof vi.fn>;
const listByVisitorMock = sessionRepo.listByVisitor as unknown as ReturnType<typeof vi.fn>;
const forgetMock = sessionService.forget as unknown as ReturnType<typeof vi.fn>;

function jsonReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/chat/gdpr/forget', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function rawReq(body: string): NextRequest {
  return new NextRequest('http://localhost/api/admin/chat/gdpr/forget', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
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

describe('POST /api/admin/chat/gdpr/forget', () => {
  it('renvoie 401 si non admin', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: new Response('unauthorized', { status: 401 }),
    });
    const res = await POST(jsonReq({ sessionId: 'cs_abc' }));
    expect(res.status).toBe(401);
  });

  it('renvoie 400 si JSON invalide', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    const res = await POST(rawReq('{not-json'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid-json');
  });

  it('renvoie 400 si ni sessionId ni visitorId', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    const res = await POST(jsonReq({}));
    expect(res.status).toBe(400);
  });

  it('renvoie 400 si sessionId ET visitorId', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    const res = await POST(jsonReq({ sessionId: 'cs_abc', visitorId: 'visitor-1' }));
    expect(res.status).toBe(400);
  });

  it('renvoie 404 si sessionId inexistant', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    getByIdMock.mockResolvedValueOnce(null);
    const res = await POST(jsonReq({ sessionId: 'cs_abc' }));
    expect(res.status).toBe(404);
  });

  it('renvoie 200 + alreadyPurged si session déjà purgée', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    getByIdMock.mockResolvedValueOnce(sessionRow({ status: 'purged' }));
    const res = await POST(jsonReq({ sessionId: 'cs_abc' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; alreadyPurged: boolean; purgedCount: number };
    expect(body).toEqual({ ok: true, alreadyPurged: true, purgedCount: 0 });
    expect(forgetMock).not.toHaveBeenCalled();
  });

  it('renvoie 200 + purgedCount=1 quand session OK', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    getByIdMock.mockResolvedValueOnce(sessionRow());
    forgetMock.mockResolvedValueOnce(undefined);
    const res = await POST(jsonReq({ sessionId: 'cs_abc' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; purgedCount: number };
    expect(body.ok).toBe(true);
    expect(body.purgedCount).toBe(1);
    expect(forgetMock).toHaveBeenCalledWith('cs_abc');
  });

  it('renvoie 200 + purgedCount multi quand visitorId fournit plusieurs sessions', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    listByVisitorMock.mockResolvedValueOnce([
      sessionRow({ id: 'cs_1' }),
      sessionRow({ id: 'cs_2', status: 'archived' }),
      sessionRow({ id: 'cs_3', status: 'purged' }),
    ]);
    forgetMock.mockResolvedValue(undefined);
    const res = await POST(jsonReq({ visitorId: 'visitor-1' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      purgedCount: number;
      scanned: number;
    };
    expect(body.purgedCount).toBe(2);
    expect(body.scanned).toBe(3);
    expect(forgetMock).toHaveBeenCalledTimes(2);
  });

  it('renvoie 500 si sessionService.forget throw', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    getByIdMock.mockResolvedValueOnce(sessionRow());
    forgetMock.mockRejectedValueOnce(new Error('db-down'));
    const res = await POST(jsonReq({ sessionId: 'cs_abc' }));
    expect(res.status).toBe(500);
  });
});
