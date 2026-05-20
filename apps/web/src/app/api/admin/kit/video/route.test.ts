/**
 * Tests routes admin `/api/admin/kit/video` (GET + PATCH).
 *
 * Stratégie : mock `getAdminSession`, `revalidateTag`, `logAuditEvent`.
 * Le store memoryStore + le resolver sont utilisés en vrai (reset entre tests).
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
  publishKitVideoOverride,
  upsertKitVideoOverride,
} from '@/lib/kit/video/store';
import { GET, PATCH } from './route';

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

describe('GET /api/admin/kit/video', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('200 retourne override:null + resolved=mock quand aucun override', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      override: unknown;
      resolved: { meta: { source: string } };
    };
    expect(body.override).toBeNull();
    expect(body.resolved.meta.source).toBe('mock');
  });

  it('200 retourne l\'override quand il existe', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    upsertKitVideoOverride({ provenance: 'Filmé à Rabat.' });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      override: { provenance: string; publishedAt: string | null } | null;
      resolved: { meta: { source: string } };
    };
    expect(body.override?.provenance).toBe('Filmé à Rabat.');
    expect(body.resolved.meta.source).toBe('override-draft');
  });
});

function jsonRequest(payload: unknown): Request {
  return new Request('http://test/api/admin/kit/video', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

describe('PATCH /api/admin/kit/video', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await PATCH(jsonRequest({}));
    expect(res.status).toBe(401);
  });

  it('422 si JSON invalide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await PATCH(
      new Request('http://test/x', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect([400, 422]).toContain(res.status);
  });

  it('422 si schema invalide (URL YouTube hors format)', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await PATCH(jsonRequest({ youtubeUrl: 'https://vimeo.com/12' }));
    expect(res.status).toBe(422);
  });

  it('200 sauve le patch et émet audit kit_video.update', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await PATCH(jsonRequest({ provenance: 'Filmé à Rabat.' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { override: { provenance: string } };
    expect(body.override.provenance).toBe('Filmé à Rabat.');
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'kit_video.update', actorId: 'adm_1' }),
    );
    expect(revalidateTag).toHaveBeenCalledWith('kit:video');
  });

  it('200 efface un champ via null', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await PATCH(jsonRequest({ provenance: 'Première version.' }));
    const res = await PATCH(jsonRequest({ provenance: null }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { override: { provenance: string | null } };
    expect(body.override.provenance).toBeNull();
  });

  it('un patch sur override publié repasse en draftedAt', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    upsertKitVideoOverride({ provenance: 'V1.' });
    publishKitVideoOverride();
    const res = await PATCH(jsonRequest({ provenance: 'V2.' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      override: { publishedAt: string | null; draftedAt: string | null };
    };
    expect(body.override.publishedAt).not.toBeNull();
    expect(body.override.draftedAt).not.toBeNull();
  });
});
