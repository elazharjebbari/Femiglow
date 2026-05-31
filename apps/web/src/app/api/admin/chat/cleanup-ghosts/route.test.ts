/**
 * CHA-LEAD-V2 — Tests endpoint POST /api/admin/chat/cleanup-ghosts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));
vi.mock('@/lib/chat/admin/cleanup', () => ({
  cleanupGhosts: vi.fn(),
}));
vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { POST } from './route';
import { getAdminSession } from '@/lib/auth/require-admin';
import { cleanupGhosts } from '@/lib/chat/admin/cleanup';

function makeReq(body: unknown): any {
  return {
    json: () => Promise.resolve(body),
  };
}

describe('POST /api/admin/chat/cleanup-ghosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renvoie 401 si pas de session admin', async () => {
    (getAdminSession as any).mockResolvedValue(null);
    const res = await POST(makeReq({ dryRun: true }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('unauthorized');
  });

  it('renvoie 400 si olderThanDays < 7', async () => {
    (getAdminSession as any).mockResolvedValue({ email: 'admin@femiglow.local' });
    const res = await POST(makeReq({ dryRun: true, olderThanDays: 3 }));
    expect(res.status).toBe(400);
  });

  it('renvoie 400 si JSON invalide', async () => {
    (getAdminSession as any).mockResolvedValue({ email: 'admin@femiglow.local' });
    const badReq: any = { json: () => Promise.reject(new Error('bad')) };
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });

  it('renvoie 200 avec candidates en dryRun', async () => {
    (getAdminSession as any).mockResolvedValue({ email: 'admin@femiglow.local' });
    (cleanupGhosts as any).mockResolvedValue({
      candidates: 42,
      archived: 0,
      dryRun: true,
      criteria: { olderThanDays: 30, kinds: ['wizard_pivot'], withoutLead: true },
    });
    const res = await POST(makeReq({ dryRun: true }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.candidates).toBe(42);
    expect(json.archived).toBe(0);
    expect(json.dryRun).toBe(true);
  });

  it('renvoie 200 avec archived=N en execute', async () => {
    (getAdminSession as any).mockResolvedValue({ email: 'admin@femiglow.local' });
    (cleanupGhosts as any).mockResolvedValue({
      candidates: 42,
      archived: 42,
      dryRun: false,
      criteria: { olderThanDays: 30, kinds: ['wizard_pivot'], withoutLead: true },
    });
    const res = await POST(makeReq({ dryRun: false }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.archived).toBe(42);
  });

  it('renvoie 500 si cleanup throw', async () => {
    (getAdminSession as any).mockResolvedValue({ email: 'admin@femiglow.local' });
    (cleanupGhosts as any).mockRejectedValue(new Error('DB unavailable'));
    const res = await POST(makeReq({ dryRun: true }));
    expect(res.status).toBe(500);
  });
});
