import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { GET, PATCH } from './route';

beforeEach(() => {
  resetMemoryStore();
  vi.mocked(getAdminSession).mockReset();
});

function adminSession() {
  return { adminId: 'adm_1', email: 'a@b.c', issuedAt: 0, expiresAt: 0 } as never;
}

function jsonRequest(body: unknown): Request {
  return new Request('http://x/api/admin/analytics/insights/settings', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET settings', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('200 retourne enabled+intervalMinutes par défaut', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { enabled: boolean; intervalMinutes: number };
    expect(body.enabled).toBe(true);
    expect(body.intervalMinutes).toBe(15);
  });
});

describe('PATCH settings', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await PATCH(jsonRequest({ enabled: false }));
    expect(res.status).toBe(401);
  });

  it('met à jour enabled=false', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await PATCH(jsonRequest({ enabled: false }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { enabled: boolean };
    expect(body.enabled).toBe(false);
  });

  it('met à jour intervalMinutes=30', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await PATCH(jsonRequest({ intervalMinutes: 30 }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { intervalMinutes: number };
    expect(body.intervalMinutes).toBe(30);
  });

  it('refuse intervalMinutes=7 (non autorisé)', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await PATCH(jsonRequest({ intervalMinutes: 7 }));
    expect(res.status).toBe(400);
  });
});
