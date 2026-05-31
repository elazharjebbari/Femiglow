/**
 * LEGAL-V2 — Tests endpoint DELETE /api/admin/legal/cleanup-e2e.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));
vi.mock('@/lib/legal/cleanup', () => ({
  cleanupLegalE2E: vi.fn(),
}));
vi.mock('@/lib/legal/csrf', () => ({
  requireSameOrigin: vi.fn(),
}));
vi.mock('@/lib/legal/audit', () => ({
  logLegalEvent: vi.fn(),
}));

import { DELETE } from './route';
import { getAdminSession } from '@/lib/auth/require-admin';
import { cleanupLegalE2E } from '@/lib/legal/cleanup';

function makeReq(body: unknown): any {
  return {
    json: () => Promise.resolve(body),
    headers: { get: () => 'http://localhost:3001' },
  };
}

describe('DELETE /api/admin/legal/cleanup-e2e', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('401 sans auth', async () => {
    (getAdminSession as any).mockResolvedValue(null);
    const res = await DELETE(makeReq({}));
    expect(res.status).toBe(401);
  });

  it('200 dryRun', async () => {
    (getAdminSession as any).mockResolvedValue({ adminId: 'admin_1' });
    (cleanupLegalE2E as any).mockResolvedValue({
      candidates: 5, deleted: 0, dryRun: true,
      criteria: { slugLike: 'e2e-test-%', status: 'draft', olderThanDays: 7 },
    });
    const res = await DELETE(makeReq({ dryRun: true, olderThanDays: 7 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.candidates).toBe(5);
    expect(json.deleted).toBe(0);
  });

  it('200 execute supprime', async () => {
    (getAdminSession as any).mockResolvedValue({ adminId: 'admin_1' });
    (cleanupLegalE2E as any).mockResolvedValue({
      candidates: 3, deleted: 3, dryRun: false,
      criteria: { slugLike: 'e2e-test-%', status: 'draft', olderThanDays: 7 },
    });
    const res = await DELETE(makeReq({ dryRun: false }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deleted).toBe(3);
  });

  it('400 si olderThanDays < 7', async () => {
    (getAdminSession as any).mockResolvedValue({ adminId: 'admin_1' });
    const res = await DELETE(makeReq({ dryRun: true, olderThanDays: 3 }));
    expect(res.status).toBe(400);
  });
});
