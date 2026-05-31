/**
 * Tests POST /api/admin/kit/video/reset.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));
vi.mock('@/lib/audit/log-event', () => ({
  logAuditEvent: vi.fn(async () => ({ id: 'ae_test' })),
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { revalidateTag } from 'next/cache';
import { logAuditEvent } from '@/lib/audit/log-event';
import { resetMemoryStore } from '@/lib/db/client';
import {
  getKitVideoOverride,
  upsertKitVideoOverride,
} from '@/lib/kit/video/store';
import { POST } from './route';

function adminSession() {
  return {
    adminId: 'adm_1',
    email: 'a@b.c',
    issuedAt: 0,
    expiresAt: 0,
  } as never;
}

beforeEach(() => {
  resetMemoryStore();
  vi.mocked(getAdminSession).mockReset();
  vi.mocked(revalidateTag).mockReset();
  vi.mocked(logAuditEvent).mockReset();
  vi.mocked(logAuditEvent).mockResolvedValue({ id: 'ae_test' } as never);
});

describe('POST /api/admin/kit/video/reset', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('200 supprime l\'override et émet audit', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    upsertKitVideoOverride({ provenance: 'Filmé à Rabat.' });
    expect(getKitVideoOverride()).not.toBeNull();

    const res = await POST();
    expect(res.status).toBe(200);
    expect(getKitVideoOverride()).toBeNull();
    expect(revalidateTag).toHaveBeenCalledWith('kit:video');
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'kit_video.reset', actorId: 'adm_1' }),
    );
  });

  it('200 sur store vide (idempotent)', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST();
    expect(res.status).toBe(200);
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ meta: { hadOverride: false } }),
    );
  });
});
