/**
 * Tests routes /api/admin/kit/composition/[id] (GET + PATCH + publish + reset).
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
  publishKitCompositionOverride,
  upsertKitCompositionOverride,
} from '@/lib/kit/composition/store';
import { GET, PATCH } from './route';
import { POST as publishPOST } from './publish/route';
import { POST as resetPOST } from './reset/route';

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

describe('GET /api/admin/kit/composition/[id]', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await GET(new Request('http://test'), { params: { id: '1-paste' } });
    expect(res.status).toBe(401);
  });

  it('404 si subProductId hors enum', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET(new Request('http://test'), {
      params: { id: 'unknown' },
    });
    expect(res.status).toBe(404);
  });

  it('200 retourne override:null + resolved=mock', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET(new Request('http://test'), { params: { id: '1-paste' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      override: unknown;
      resolved: { meta: { source: string } };
    };
    expect(body.override).toBeNull();
    expect(body.resolved.meta.source).toBe('mock');
  });

  it('200 retourne le draft existant', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    upsertKitCompositionOverride({
      subProductId: '1-paste',
      narrative: 'Test.',
    });
    const res = await GET(new Request('http://test'), { params: { id: '1-paste' } });
    const body = (await res.json()) as {
      override: { narrative: string };
      resolved: { meta: { source: string } };
    };
    expect(body.override.narrative).toBe('Test.');
    expect(body.resolved.meta.source).toBe('override-draft');
  });
});

function jsonRequest(payload: unknown): Request {
  return new Request('http://test/x', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

describe('PATCH /api/admin/kit/composition/[id]', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await PATCH(jsonRequest({}), { params: { id: '1-paste' } });
    expect(res.status).toBe(401);
  });

  it('404 si subProductId hors enum', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await PATCH(jsonRequest({}), { params: { id: 'bidon' } });
    expect(res.status).toBe(404);
  });

  it('422 si payload invalide (narrative sans ponctuation)', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await PATCH(
      jsonRequest({ narrative: 'Pas de ponctuation' }),
      { params: { id: '1-paste' } },
    );
    expect(res.status).toBe(422);
  });

  it('200 sauve patch et émet audit + revalidateTag', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await PATCH(jsonRequest({ narrative: 'OK.' }), {
      params: { id: '1-paste' },
    });
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith('kit-composition');
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'kit_composition.update', actorId: 'adm_1' }),
    );
  });
});

describe('POST /publish', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await publishPOST(new Request('http://x'), { params: { id: '1-paste' } });
    expect(res.status).toBe(401);
  });

  it('404 si subProductId hors enum', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await publishPOST(new Request('http://x'), { params: { id: 'bidon' } });
    expect(res.status).toBe(404);
  });

  it('404 si aucun brouillon à publier', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await publishPOST(new Request('http://x'), { params: { id: '1-paste' } });
    expect(res.status).toBe(404);
  });

  it('200 publie + audit', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    upsertKitCompositionOverride({ subProductId: '1-paste', narrative: 'A.' });
    const res = await publishPOST(new Request('http://x'), { params: { id: '1-paste' } });
    expect(res.status).toBe(200);
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'kit_composition.publish' }),
    );
  });
});

describe('POST /reset', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await resetPOST(new Request('http://x'), { params: { id: '1-paste' } });
    expect(res.status).toBe(401);
  });

  it('404 si subProductId hors enum', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await resetPOST(new Request('http://x'), { params: { id: 'bidon' } });
    expect(res.status).toBe(404);
  });

  it('200 idempotent même sans override', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await resetPOST(new Request('http://x'), { params: { id: '1-paste' } });
    expect(res.status).toBe(200);
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ meta: { hadOverride: false } }),
    );
  });

  it('200 supprime un override existant + audit', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    upsertKitCompositionOverride({ subProductId: '1-paste', narrative: 'A.' });
    const res = await resetPOST(new Request('http://x'), { params: { id: '1-paste' } });
    expect(res.status).toBe(200);
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ meta: { hadOverride: true } }),
    );
  });
});
