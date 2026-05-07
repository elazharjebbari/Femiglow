/**
 * Suite intégration MSW — POST /api/admin/components/seed-from-docs.
 *
 * Le pipeline réel lit le filesystem et fait du sharp ; on **mock**
 * `seedFromDocs` pour ne tester que la couche route (auth + rate-limit
 * + payload + audit).
 *
 * Couvre :
 *  - 200 → dry-run accepté, retourne le rapport
 *  - 200 → autoActivate transmis au pipeline
 *  - 401 → sans session
 *  - 400 → payload invalide
 *  - 429 → rate-limit après 3 appels successifs
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';

let sessionMock: { adminId: string; email: string; issuedAt: number; expiresAt: number } | null = {
  adminId: 'adm_1',
  email: 'admin@femiglow.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 1000 * 60 * 60,
};

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
  requireAdmin: () => Promise.resolve(sessionMock),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}));

const seedSpy = vi.fn(async (opts: unknown) => ({
  components: { synced: 0 },
  animations: { synced: 0 },
  images: { total: 0, seeded: 0, skipped: 0, activated: 0, unmapped: [], errors: [] },
  durationMs: 1,
  __opts: opts,
}));

vi.mock('@/lib/components/seed-pipeline', () => ({
  seedFromDocs: (opts: unknown) => seedSpy(opts),
}));

import { POST } from '@/app/api/admin/components/seed-from-docs/route';
import { resetMemoryStore } from '@/lib/db/client';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  sessionMock = {
    adminId: 'adm_1',
    email: 'admin@femiglow.ma',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60,
  };
  seedSpy.mockClear();
});
afterAll(() => server.close());

beforeEach(() => {
  resetMemoryStore();
});

function buildReq(body: unknown, ip = '10.0.0.1') {
  return new Request('http://localhost/api/admin/components/seed-from-docs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/components/seed-from-docs', () => {
  it('dry-run renvoie le rapport', async () => {
    const res = await POST(buildReq({ dryRun: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report).toMatchObject({ images: { errors: [] } });
    expect(seedSpy).toHaveBeenCalledTimes(1);
  });

  it('autoActivate transmis au pipeline', async () => {
    await POST(buildReq({ autoActivate: true, force: true }));
    const opts = seedSpy.mock.calls[0]?.[0] as { autoActivate?: boolean; force?: boolean };
    expect(opts.autoActivate).toBe(true);
    expect(opts.force).toBe(true);
  });

  it('401 sans session', async () => {
    sessionMock = null;
    const res = await POST(buildReq({ dryRun: true }));
    expect(res.status).toBe(401);
    expect(seedSpy).not.toHaveBeenCalled();
  });

  it('400 payload invalide', async () => {
    const res = await POST(buildReq({ filterPageGroup: 123 }));
    expect(res.status).toBe(400);
    expect(seedSpy).not.toHaveBeenCalled();
  });

  it('429 après 3 appels (rate-limit IP)', async () => {
    const ip = '10.0.0.42';
    for (let i = 0; i < 3; i += 1) {
      const ok = await POST(buildReq({ dryRun: true }, ip));
      expect(ok.status).toBe(200);
    }
    const blocked = await POST(buildReq({ dryRun: true }, ip));
    expect(blocked.status).toBe(429);
  });
});
