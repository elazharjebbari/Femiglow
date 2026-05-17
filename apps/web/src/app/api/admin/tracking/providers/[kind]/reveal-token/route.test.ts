import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { GET } from './route';

const adminSession = {
  adminId: 'adm_reveal_test',
  email: 'admin@femiglow.test',
  issuedAt: 0,
  expiresAt: Date.now() + 60_000,
} as never;

beforeEach(() => {
  resetMemoryStore();
  vi.mocked(getAdminSession).mockReset();
  vi.mocked(getAdminSession).mockResolvedValue(adminSession);
});

describe('/api/admin/tracking/providers/[kind]/reveal-token', () => {
  it('retourne le token déchiffré pour un provider existant', async () => {
    const { upsertTrackingProvider } = await import('@/lib/db/queries/tracking/providers');
    await upsertTrackingProvider({
      kind: 'snap',
      capiToken: 'my-secret-snap-token',
    });

    const res = await GET(new Request('https://femiglow.test/api/admin/tracking/providers/snap/reveal-token'), {
      params: Promise.resolve({ kind: 'snap' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { capiToken: string | null };
    expect(body.capiToken).toBe('my-secret-snap-token');
  });

  it('retourne null si le provider n\'existe pas', async () => {
    const res = await GET(new Request('https://femiglow.test/api/admin/tracking/providers/meta/reveal-token'), {
      params: Promise.resolve({ kind: 'meta' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { capiToken: string | null };
    expect(body.capiToken).toBeNull();
  });

  it('retourne 401 sans session admin', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null as never);
    const res = await GET(new Request('https://femiglow.test/api/admin/tracking/providers/snap/reveal-token'), {
      params: Promise.resolve({ kind: 'snap' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejette un kind invalide', async () => {
    const res = await GET(new Request('https://femiglow.test/api/admin/tracking/providers/invalid/reveal-token'), {
      params: Promise.resolve({ kind: 'invalid' }),
    });
    expect(res.status).toBe(400);
  });
});