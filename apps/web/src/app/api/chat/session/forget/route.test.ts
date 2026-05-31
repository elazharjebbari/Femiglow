/**
 * CHAT-065 — Tests `POST /api/chat/session/forget`.
 *
 * On valide :
 *  - 400 si JSON invalide
 *  - 400 si sessionId invalide (pas le format cs_xxx)
 *  - 404 si session inexistante
 *  - 403 si le visitorId du cookie ne matche pas
 *  - 200 si la session est déjà purgée (idempotent → alreadyPurged: true)
 *  - 200 + appel sessionService.forget quand tout est OK
 *  - 500 si sessionService.forget throw
 *  - 404 quand chat désactivé (feature-flag)
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/chat/feature-flag', () => ({
  assertChatEnabled: vi.fn(),
  ChatDisabledError: class ChatDisabledError extends Error {
    constructor(msg?: string) {
      super(msg);
      this.name = 'ChatDisabledError';
    }
  },
}));

vi.mock('@/lib/chat/repos/session', () => ({
  sessionRepo: {
    getById: vi.fn(),
  },
}));

vi.mock('@/lib/chat/services/session-service', () => ({
  sessionService: {
    forget: vi.fn(),
  },
}));

vi.mock('@/lib/chat/services/visitor-cookie', () => ({
  getVisitorId: vi.fn(),
}));

import { ChatDisabledError, assertChatEnabled } from '@/lib/chat/feature-flag';
import { sessionRepo } from '@/lib/chat/repos/session';
import { sessionService } from '@/lib/chat/services/session-service';
import { getVisitorId } from '@/lib/chat/services/visitor-cookie';
import { POST } from './route';

const assertEnabledMock = assertChatEnabled as unknown as ReturnType<typeof vi.fn>;
const getByIdMock = sessionRepo.getById as unknown as ReturnType<typeof vi.fn>;
const forgetMock = sessionService.forget as unknown as ReturnType<typeof vi.fn>;
const visitorMock = getVisitorId as unknown as ReturnType<typeof vi.fn>;

function jsonReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/chat/session/forget', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function rawReq(body: string): NextRequest {
  return new NextRequest('http://localhost/api/chat/session/forget', {
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

describe('POST /api/chat/session/forget', () => {
  it('rejette 404 quand chat désactivé', async () => {
    assertEnabledMock.mockImplementationOnce(() => {
      throw new ChatDisabledError();
    });
    const res = await POST(jsonReq({ sessionId: 'cs_abc' }));
    expect(res.status).toBe(404);
  });

  it('rejette 400 si JSON invalide', async () => {
    assertEnabledMock.mockImplementationOnce(() => {});
    const res = await POST(rawReq('{not-json'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid-json');
  });

  it('rejette 400 si sessionId mal formé', async () => {
    assertEnabledMock.mockImplementationOnce(() => {});
    const res = await POST(jsonReq({ sessionId: 'not-a-session-id' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid-input');
  });

  it('renvoie 404 si la session est inexistante', async () => {
    assertEnabledMock.mockImplementationOnce(() => {});
    getByIdMock.mockResolvedValueOnce(null);
    const res = await POST(jsonReq({ sessionId: 'cs_abc' }));
    expect(res.status).toBe(404);
  });

  it("renvoie 200 + alreadyPurged si la session est déjà purgée (idempotent)", async () => {
    assertEnabledMock.mockImplementationOnce(() => {});
    getByIdMock.mockResolvedValueOnce(sessionRow({ status: 'purged' }));
    const res = await POST(jsonReq({ sessionId: 'cs_abc' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; alreadyPurged: boolean };
    expect(body).toEqual({ ok: true, alreadyPurged: true });
    expect(forgetMock).not.toHaveBeenCalled();
  });

  it('renvoie 403 si le visitorId du cookie ne matche pas', async () => {
    assertEnabledMock.mockImplementationOnce(() => {});
    getByIdMock.mockResolvedValueOnce(sessionRow({ visitorId: 'visitor-OTHER' }));
    visitorMock.mockReturnValueOnce('visitor-1');
    const res = await POST(jsonReq({ sessionId: 'cs_abc' }));
    expect(res.status).toBe(403);
    expect(forgetMock).not.toHaveBeenCalled();
  });

  it('renvoie 200 + appelle sessionService.forget quand tout est OK', async () => {
    assertEnabledMock.mockImplementationOnce(() => {});
    getByIdMock.mockResolvedValueOnce(sessionRow({ visitorId: 'visitor-1' }));
    visitorMock.mockReturnValueOnce('visitor-1');
    forgetMock.mockResolvedValueOnce(undefined);
    const res = await POST(jsonReq({ sessionId: 'cs_abc' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; alreadyPurged: boolean };
    expect(body).toEqual({ ok: true, alreadyPurged: false });
    expect(forgetMock).toHaveBeenCalledWith('cs_abc');
  });

  it('renvoie 500 si sessionService.forget throws', async () => {
    assertEnabledMock.mockImplementationOnce(() => {});
    getByIdMock.mockResolvedValueOnce(sessionRow({ visitorId: 'visitor-1' }));
    visitorMock.mockReturnValueOnce('visitor-1');
    forgetMock.mockRejectedValueOnce(new Error('db-down'));
    const res = await POST(jsonReq({ sessionId: 'cs_abc' }));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('internal');
  });
});
