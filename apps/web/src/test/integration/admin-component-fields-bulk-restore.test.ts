/**
 * Suite intégration — POST /api/admin/components/bindings/bulk-restore (P11).
 *
 * Couvre :
 *   - happy path multi-items (2 champs restaurés en un seul call),
 *   - 401 sans session,
 *   - 400 payload invalide,
 *   - report partiel (un item échoue, l'autre réussit).
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
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

const revalidateTagMock = vi.fn();
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}));

import { POST as bulkRestore } from '@/app/api/admin/components/bindings/bulk-restore/route';
import { resetMemoryStore } from '@/lib/db/client';
import { upsertSiteComponentFromSeed } from '@/lib/db/queries/site-components';
import {
  ensureSeedPublishedBinding,
  listHistory,
  upsertDraftBinding,
  publishBinding,
} from '@/lib/db/queries/component-fields';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import type { SiteComponentSeed } from '@/lib/components/registry';

const SEED: SiteComponentSeed = {
  key: 'home-hero',
  name: 'Hero',
  description: '',
  category: 'hero',
  pageGroup: 'home',
  filePath: 'src/components/sections/Hero.tsx',
  slots: [],
  defaultSvgFallback: null,
  defaultLoadingStrategy: 'eager',
  defaultFetchPriority: 'high',
  supportsAnimation: false,
  fields: [
    {
      key: 'title',
      label: 'Titre',
      type: 'text',
      required: true,
      defaultValue: 'Bienvenue',
      config: { maxLength: 80 },
    },
    {
      key: 'subtitle',
      label: 'Sous-titre',
      type: 'text',
      required: false,
      defaultValue: 'sous',
      config: { maxLength: 80 },
    },
  ],
};

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  sessionMock = {
    adminId: 'adm_1',
    email: 'admin@femiglow.ma',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60,
  };
  revalidateTagMock.mockClear();
});
afterAll(() => server.close());

beforeEach(async () => {
  resetMemoryStore();
  await upsertSiteComponentFromSeed(SEED);
});

function jsonRequest(url: string, init: RequestInit = {}): Request {
  return new Request(url, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

async function setupHistory(fieldKey: string, valueV1: string, valueV2: string): Promise<{
  componentId: string;
  v1HistoryId: string;
}> {
  const cmp = await getSiteComponentByKey('home-hero');
  // Seed v1 published.
  await ensureSeedPublishedBinding({ componentId: cmp!.id, fieldKey, value: valueV1 });
  // Mise à jour : draft v2.
  const draft2 = await upsertDraftBinding({
    componentId: cmp!.id,
    fieldKey,
    value: valueV2,
    authorId: 'adm_1',
  });
  await publishBinding({ bindingId: draft2.id, actorId: 'adm_1' });
  // On a 2+ entrées d'historique : create + publish (et le seed a aussi un create).
  const hist = await listHistory(cmp!.id, fieldKey, 'fr', 100);
  const v1Snapshot = hist.find(
    (h) => typeof h.value === 'string' && h.value === valueV1,
  );
  return { componentId: cmp!.id, v1HistoryId: v1Snapshot!.id };
}

describe('POST /api/admin/components/bindings/bulk-restore', () => {
  it('401 sans session', async () => {
    sessionMock = null;
    const res = await bulkRestore(
      jsonRequest('http://x/api/admin/components/bindings/bulk-restore', {
        method: 'POST',
        body: JSON.stringify({ items: [] }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('400 payload invalide', async () => {
    const res = await bulkRestore(
      jsonRequest('http://x', {
        method: 'POST',
        body: JSON.stringify({ items: [] }), // empty -> min(1)
      }),
    );
    expect(res.status).toBe(400);
  });

  it('207 happy path : 2 champs restaurés', async () => {
    const t = await setupHistory('title', 'V1-title', 'V2-title');
    const s = await setupHistory('subtitle', 'V1-sub', 'V2-sub');

    const res = await bulkRestore(
      jsonRequest('http://x', {
        method: 'POST',
        body: JSON.stringify({
          items: [
            { componentKey: 'home-hero', fieldKey: 'title', historyId: t.v1HistoryId },
            { componentKey: 'home-hero', fieldKey: 'subtitle', historyId: s.v1HistoryId },
          ],
        }),
      }),
    );
    expect(res.status).toBe(207);
    const body = (await res.json()) as {
      results: Array<{ ok: boolean; bindingId?: string; error?: string }>;
      summary: { total: number; ok: number; failed: number };
    };
    expect(body.summary).toEqual({ total: 2, ok: 2, failed: 0 });
    expect(body.results.every((r) => r.ok)).toBe(true);
    expect(revalidateTagMock).toHaveBeenCalledWith('components');
  });

  it('207 partial : 1 success + 1 fail (componentKey inconnu)', async () => {
    const t = await setupHistory('title', 'V1-title', 'V2-title');
    const res = await bulkRestore(
      jsonRequest('http://x', {
        method: 'POST',
        body: JSON.stringify({
          items: [
            { componentKey: 'home-hero', fieldKey: 'title', historyId: t.v1HistoryId },
            { componentKey: 'zzz-unknown', fieldKey: 'title', historyId: t.v1HistoryId },
          ],
        }),
      }),
    );
    expect(res.status).toBe(207);
    const body = (await res.json()) as {
      summary: { total: number; ok: number; failed: number };
      results: Array<{ ok: boolean; error?: string; componentKey: string }>;
    };
    expect(body.summary).toEqual({ total: 2, ok: 1, failed: 1 });
    const failed = body.results.find((r) => r.componentKey === 'zzz-unknown');
    expect(failed?.ok).toBe(false);
    expect(failed?.error).toMatch(/introuvable/i);
  });

  it('207 fail : historyId d\'un autre champ → mismatch', async () => {
    const t = await setupHistory('title', 'V1-title', 'V2-title');
    // Tente de restaurer le snapshot 'title' sur le champ 'subtitle'.
    const res = await bulkRestore(
      jsonRequest('http://x', {
        method: 'POST',
        body: JSON.stringify({
          items: [
            { componentKey: 'home-hero', fieldKey: 'subtitle', historyId: t.v1HistoryId },
          ],
        }),
      }),
    );
    expect(res.status).toBe(207);
    const body = (await res.json()) as {
      results: Array<{ ok: boolean; error?: string }>;
    };
    expect(body.results[0]!.ok).toBe(false);
    expect(body.results[0]!.error).toMatch(/ne correspond pas/i);
  });
});
