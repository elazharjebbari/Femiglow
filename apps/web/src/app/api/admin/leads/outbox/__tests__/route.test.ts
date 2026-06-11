/**
 * OWBS F11 — routes admin outbox : auth + supervision + replay.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sessionMock, repoMock } = vi.hoisted(() => ({
  sessionMock: { value: null as null | { adminId: string } },
  repoMock: { counts: vi.fn(), listByStatus: vi.fn(), replay: vi.fn() },
}));

vi.mock('@/lib/auth/require-admin', () => ({ getAdminSession: () => Promise.resolve(sessionMock.value) }));
vi.mock('@/lib/leads/outbox/lead-outbox-repo', () => ({ leadOutboxRepo: repoMock }));
vi.mock('@/lib/audit/log-event', () => ({ logAuditEvent: vi.fn(() => Promise.resolve()) }));

import { GET } from '../route';
import { POST } from '../[id]/replay/route';

beforeEach(() => {
  sessionMock.value = null;
  repoMock.counts.mockReset().mockResolvedValue({ pending: 1, processing: 0, done: 2, dead: 1 });
  repoMock.listByStatus.mockReset().mockResolvedValue([]);
  repoMock.replay.mockReset();
});

const replayReq = () => new Request('http://test/api/admin/leads/outbox/lox_x/replay', { method: 'POST' });

describe('GET /api/admin/leads/outbox', () => {
  it('401 sans session admin', async () => {
    const res = await GET();
    expect(res.status).toBe(401);
    expect(repoMock.counts).not.toHaveBeenCalled();
  });

  it('200 + counts/dead/pending avec session', async () => {
    sessionMock.value = { adminId: 'adm_1' };
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.counts.dead).toBe(1);
    expect(body).toHaveProperty('dead');
    expect(body).toHaveProperty('pending');
  });
});

describe('POST /api/admin/leads/outbox/[id]/replay', () => {
  it('401 sans session admin', async () => {
    const res = await POST(replayReq(), { params: { id: 'lox_x' } });
    expect(res.status).toBe(401);
    expect(repoMock.replay).not.toHaveBeenCalled();
  });

  it('200 si un dead est rejoué', async () => {
    sessionMock.value = { adminId: 'adm_1' };
    repoMock.replay.mockResolvedValue(true);
    const res = await POST(replayReq(), { params: { id: 'lox_x' } });
    expect(res.status).toBe(200);
    expect(repoMock.replay).toHaveBeenCalledWith('lox_x');
  });

  it('404 si non-dead / introuvable', async () => {
    sessionMock.value = { adminId: 'adm_1' };
    repoMock.replay.mockResolvedValue(false);
    const res = await POST(replayReq(), { params: { id: 'lox_x' } });
    expect(res.status).toBe(404);
  });
});
