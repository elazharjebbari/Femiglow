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
  adminId: 'adm_list_test',
  email: 'admin@femiglow.test',
  issuedAt: 0,
  expiresAt: Date.now() + 60_000,
} as never;

beforeEach(() => {
  resetMemoryStore();
  vi.mocked(getAdminSession).mockReset();
  vi.mocked(getAdminSession).mockResolvedValue(adminSession);
});

describe('/api/admin/tracking/providers', () => {
  it('GET retourne la liste des providers sans token brut', async () => {
    const { upsertTrackingProvider } = await import('@/lib/db/queries/tracking/providers');
    await upsertTrackingProvider({ kind: 'snap', status: 'enabled', pixelId: 'test-pixel', capiToken: 'secret' });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { providers: Array<Record<string, unknown>> };
    expect(body.providers).toHaveLength(1);
    const provider = body.providers[0];
    if (!provider) throw new Error('expected at least one provider after assertion');
    expect(provider.kind).toBe('snap');
    expect(provider.hasCapiToken).toBe(true);
    expect(provider.capiToken).toBeUndefined();
  });

  it('GET retourne une liste vide si aucun provider', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { providers: Array<Record<string, unknown>> };
    expect(body.providers).toHaveLength(0);
  });

  it('GET retourne 401 sans session admin', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});