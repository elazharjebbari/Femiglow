/**
 * Tests POST /api/admin/kit/video/publish.
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
import { upsertKitVideoOverride } from '@/lib/kit/video/store';
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

describe('POST /api/admin/kit/video/publish', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('404 si aucun override n\'existe', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST();
    expect(res.status).toBe(404);
  });

  it('200 publie l\'override et pose publishedAt', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    upsertKitVideoOverride({ provenance: 'Filmé à Rabat.' });
    const res = await POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      override: { publishedAt: string | null; draftedAt: string | null };
    };
    expect(body.override.publishedAt).not.toBeNull();
    expect(body.override.draftedAt).toBeNull();
  });

  it('émet audit kit_video.publish + revalidate', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    upsertKitVideoOverride({ provenance: 'Filmé à Rabat.' });
    await POST();
    expect(revalidateTag).toHaveBeenCalledWith('kit:video');
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'kit_video.publish', actorId: 'adm_1' }),
    );
  });

  it('re-publish idempotent (200 + nouveau publishedAt)', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    upsertKitVideoOverride({ provenance: 'Filmé à Rabat.' });
    await POST();
    const second = await POST();
    expect(second.status).toBe(200);
  });
});
