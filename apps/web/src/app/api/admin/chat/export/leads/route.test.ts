/**
 * CHAT-066 — Tests `GET /api/admin/chat/export/leads`.
 *
 * On valide :
 *  - 401 si non authentifié
 *  - CSV par défaut avec headers stables
 *  - JSON quand `format=json`
 *  - filtres outcome/trigger/fromDate/toDate transmis à `listChatLeads`
 *  - limit clampé à [1, 1000]
 *  - filtres invalides ignorés (pas de crash)
 *  - Content-Disposition + filename présents
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

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { adminQueries } from '@/lib/chat/admin/queries';
import { GET } from './route';

const requireAdminMock = requireAdminApi as unknown as ReturnType<typeof vi.fn>;
const listMock = adminQueries.listChatLeads as unknown as ReturnType<typeof vi.fn>;

function lead(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'cl_1',
    sessionId: 'cs_1',
    firstName: 'Sara',
    phoneE164: '+212600000001',
    phoneRaw: '0600000001',
    triggerReason: 'purchase-intent',
    outcome: 'pending',
    language: 'fr',
    intentAtCapture: 'purchase-intent',
    page: '/produit',
    referrer: null,
    webhookStatus: 'sent',
    webhookAttempts: 1,
    handledBy: null,
    consentVersion: 'v1',
    createdAt: new Date('2026-05-13T10:00:00Z'),
    triggeringMessageId: null,
    visitorId: 'visitor-1',
    fingerprintHash: null,
    note: null,
    utm: null,
    snapshotMessages: null,
    consentAt: new Date(),
    webhookLastError: null,
    webhookSentAt: null,
    handledAt: null,
    ...over,
  };
}

afterEach(() => {
  vi.resetAllMocks();
});

function buildReq(qs = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/chat/export/leads${qs}`);
}

describe('GET /api/admin/chat/export/leads', () => {
  it('renvoie 401 si non authentifié', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      response: new Response('unauthorized', { status: 401 }),
    });
    const res = await GET(buildReq());
    expect(res.status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('retourne du CSV par défaut avec les headers stables', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, session: { email: 'a@b.c' } });
    listMock.mockResolvedValueOnce([lead()]);
    const res = await GET(buildReq());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('Content-Disposition')).toMatch(/attachment; filename="chat-leads-/);
    const body = await res.text();
    const [header, line] = body.split('\n');
    expect(header).toBe(
      'id,sessionId,firstName,phoneE164,triggerReason,outcome,language,intentAtCapture,page,referrer,webhookStatus,webhookAttempts,handledBy,createdAt,consentVersion',
    );
    expect(line).toContain('cl_1');
    expect(line).toContain('+212600000001');
    expect(line).toContain('purchase-intent');
  });

  it('retourne du JSON quand format=json', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, session: { email: 'a@b.c' } });
    listMock.mockResolvedValueOnce([lead()]);
    const res = await GET(buildReq('?format=json'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    const body = (await res.json()) as Array<{ id: string }>;
    expect(body[0]?.id).toBe('cl_1');
  });

  it('transmet outcome et trigger valides à listChatLeads', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, session: { email: 'a@b.c' } });
    listMock.mockResolvedValueOnce([]);
    await GET(buildReq('?outcome=converted&trigger=b2b'));
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'converted',
        triggerReason: 'b2b',
      }),
    );
  });

  it('ignore les outcome / trigger invalides (undefined transmis)', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, session: { email: 'a@b.c' } });
    listMock.mockResolvedValueOnce([]);
    await GET(buildReq('?outcome=plop&trigger=zigouigoui'));
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: undefined, triggerReason: undefined }),
    );
  });

  it('clamp le limit à MAX 1000', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, session: { email: 'a@b.c' } });
    listMock.mockResolvedValueOnce([]);
    await GET(buildReq('?limit=999999'));
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ limit: 1000 }));
  });

  it('clamp le limit à MIN 1', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, session: { email: 'a@b.c' } });
    listMock.mockResolvedValueOnce([]);
    await GET(buildReq('?limit=0'));
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ limit: 500 }));
  });

  it("transmet fromDate / toDate quand fournis", async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, session: { email: 'a@b.c' } });
    listMock.mockResolvedValueOnce([]);
    await GET(buildReq('?fromDate=2026-05-01&toDate=2026-05-13'));
    const call = listMock.mock.calls[0]![0] as { fromDate: Date; toDate: Date };
    expect(call.fromDate).toBeInstanceOf(Date);
    expect(call.toDate).toBeInstanceOf(Date);
    expect(call.fromDate.toISOString().slice(0, 10)).toBe('2026-05-01');
  });

  it('échappe correctement les virgules et guillemets dans le CSV', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: true, session: { email: 'a@b.c' } });
    listMock.mockResolvedValueOnce([
      lead({ firstName: 'Sara, "la cliente"', page: '/path,with,comma' }),
    ]);
    const res = await GET(buildReq());
    const body = await res.text();
    expect(body).toContain('"Sara, ""la cliente"""');
    expect(body).toContain('"/path,with,comma"');
  });
});
