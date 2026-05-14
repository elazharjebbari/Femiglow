/**
 * Tests `PATCH /api/admin/chat/leads/[id]/outcome`.
 *
 * On valide :
 *  - 401 si non admin
 *  - 400 si leadId mal formé (pas cl_xxx)
 *  - 400 si JSON invalide
 *  - 400 si outcome non reconnu
 *  - 404 si lead introuvable
 *  - 200 + handledBy renseigné quand OK
 *  - convertedOrderId transmis quand fourni
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/chat/admin/auth', () => ({
  requireAdminApi: vi.fn(),
}));

vi.mock('@/lib/chat/repos/lead', () => ({
  leadRepo: {
    getById: vi.fn(),
    setOutcome: vi.fn(),
  },
}));

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { leadRepo } from '@/lib/chat/repos/lead';
import { PATCH } from './route';

const requireAdminMock = requireAdminApi as unknown as ReturnType<typeof vi.fn>;
const getByIdMock = leadRepo.getById as unknown as ReturnType<typeof vi.fn>;
const setOutcomeMock = leadRepo.setOutcome as unknown as ReturnType<typeof vi.fn>;

function jsonReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/chat/leads/cl_1/outcome', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function rawReq(body: string): NextRequest {
  return new NextRequest('http://localhost/api/admin/chat/leads/cl_1/outcome', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body,
  });
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
    handledBy: null,
    consentVersion: 'v1',
    createdAt: new Date(),
    ...over,
  };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('PATCH /api/admin/chat/leads/[id]/outcome', () => {
  it('renvoie 401 si non admin', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: new Response('unauthorized', { status: 401 }),
    });
    const res = await PATCH(jsonReq({ outcome: 'reached' }), { params: { id: 'cl_1' } });
    expect(res.status).toBe(401);
  });

  it('renvoie 400 si leadId mal formé', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    const res = await PATCH(jsonReq({ outcome: 'reached' }), { params: { id: 'wrong-id' } });
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('invalid-lead-id');
  });

  it('renvoie 400 si JSON invalide', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    const res = await PATCH(rawReq('{not-json'), { params: { id: 'cl_1' } });
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('invalid-json');
  });

  it('renvoie 400 si outcome non reconnu', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    const res = await PATCH(jsonReq({ outcome: 'sandwich' }), { params: { id: 'cl_1' } });
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('invalid-input');
  });

  it('renvoie 404 si lead introuvable', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    getByIdMock.mockResolvedValueOnce(null);
    const res = await PATCH(jsonReq({ outcome: 'reached' }), { params: { id: 'cl_1' } });
    expect(res.status).toBe(404);
  });

  it('renvoie 200 et appelle setOutcome avec handledBy', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'agent@femiglow.local' });
    getByIdMock.mockResolvedValueOnce(lead());
    setOutcomeMock.mockResolvedValueOnce(lead({ outcome: 'reached', handledBy: 'agent@femiglow.local' }));
    const res = await PATCH(jsonReq({ outcome: 'reached' }), { params: { id: 'cl_1' } });
    expect(res.status).toBe(200);
    expect(setOutcomeMock).toHaveBeenCalledWith('cl_1', 'reached', 'agent@femiglow.local', undefined);
    const body = (await res.json()) as { ok: boolean; lead: { outcome: string; handledBy: string } };
    expect(body.ok).toBe(true);
    expect(body.lead.outcome).toBe('reached');
    expect(body.lead.handledBy).toBe('agent@femiglow.local');
  });

  it('transmet convertedOrderId si fourni', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'agent@femiglow.local' });
    getByIdMock.mockResolvedValueOnce(lead());
    setOutcomeMock.mockResolvedValueOnce(lead({ outcome: 'converted' }));
    const res = await PATCH(
      jsonReq({ outcome: 'converted', convertedOrderId: 'ord_123' }),
      { params: { id: 'cl_1' } },
    );
    expect(res.status).toBe(200);
    expect(setOutcomeMock).toHaveBeenCalledWith(
      'cl_1',
      'converted',
      'agent@femiglow.local',
      'ord_123',
    );
  });

  it('renvoie 500 si setOutcome retourne null', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, email: 'a@b.c' });
    getByIdMock.mockResolvedValueOnce(lead());
    setOutcomeMock.mockResolvedValueOnce(null);
    const res = await PATCH(jsonReq({ outcome: 'reached' }), { params: { id: 'cl_1' } });
    expect(res.status).toBe(500);
  });
});
