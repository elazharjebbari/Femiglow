/**
 * Tests listmonk-sync — MSW mocks Listmonk API.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';
import { pushSnapshotToListmonk, cleanupExpiredListmonkLists } from './listmonk-sync';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.LISTMONK_INTERNAL_URL = 'http://127.0.0.1:9000';
  process.env.LISTMONK_API_USER = 'admin';
  process.env.LISTMONK_API_TOKEN = 'token';
});

describe('pushSnapshotToListmonk', () => {
  it('throws if Listmonk not configured', async () => {
    delete process.env.LISTMONK_INTERNAL_URL;
    await expect(pushSnapshotToListmonk('snap-1')).rejects.toThrow(/not configured/i);
  });

  it('throws if snapshot not found', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeFakeDrizzle({ selectResult: [] }) as never,
    );
    await expect(pushSnapshotToListmonk('snap-nope')).rejects.toThrow(/not found/i);
  });

  it('returns existing list_id when snapshot already pushed (idempotent)', async () => {
    // « Déjà poussée » = liste créée ET push marqué terminé
    // (metadata.listmonkPushedAt). Le simple listmonkListId ne suffit plus :
    // un push partiel (liste créée, membres incomplets) doit être REPRIS, pas
    // court-circuité (L-ATOM). Cf. snapshot-push-recovery.integration.test.ts.
    vi.mocked(getDb).mockReturnValue(
      makeFakeDrizzle({
        selectResult: [
          {
            id: 'snap-1',
            listmonkListId: 42,
            listmonkListName: 'fg-existing',
            size: 100,
            metadata: { listmonkPushedAt: '2026-06-01T10:00:00.000Z' },
          },
        ],
      }) as never,
    );

    const fetchImpl = vi.fn();
    const result = await pushSnapshotToListmonk('snap-1', { fetchImpl });
    expect(result.listmonkListId).toBe(42);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('creates list + pushes members in chunks', async () => {
    let selectCallCount = 0;
    const drizzle = makeFakeDrizzle({});
    drizzle.select = vi.fn(() => {
      selectCallCount += 1;
      const result =
        selectCallCount === 1
          ? [{ id: 'snap-1', listmonkListId: null, listmonkListName: null, size: 3 }]
          : [
              { email: 'a@b.c' },
              { email: 'd@e.f' },
              { email: 'g@h.i' },
            ];
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(result),
        then: (cb: (r: unknown) => unknown) => Promise.resolve(result).then(cb),
      } as never;
    }) as never;
    drizzle.update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{}]),
        then: (cb: (r: unknown) => unknown) => Promise.resolve([{}]).then(cb),
      })),
    })) as never;
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const fetchImpl = vi
      .fn()
      // POST /api/lists → list created (id=99)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: 99 } }), { status: 200 }),
      )
      // POST /api/subscribers ×3 (one per email)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: 1 } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: 2 } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: 3 } }), { status: 200 }),
      );

    const result = await pushSnapshotToListmonk('snap-1', { fetchImpl });
    expect(result.listmonkListId).toBe(99);
    expect(result.pushed).toBe(3);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    // First call : POST /api/lists
    expect(fetchImpl.mock.calls[0]![0]).toContain('/api/lists');
    // Calls 2..4 : POST /api/subscribers (one per email)
    expect(fetchImpl.mock.calls[1]![0]).toContain('/api/subscribers');
    expect(fetchImpl.mock.calls[2]![0]).toContain('/api/subscribers');
    expect(fetchImpl.mock.calls[3]![0]).toContain('/api/subscribers');
  });

  it('throws on Listmonk create list failure', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeFakeDrizzle({
        selectResult: [{ id: 'snap-1', listmonkListId: null, size: 0 }],
      }) as never,
    );

    const fetchImpl = vi.fn().mockResolvedValue(new Response('error', { status: 500 }));
    await expect(pushSnapshotToListmonk('snap-1', { fetchImpl })).rejects.toThrow(/500/);
  });
});

describe('cleanupExpiredListmonkLists', () => {
  it('returns purged=0 when no expired snapshots', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle({ selectResult: [] }) as never);
    const fetchImpl = vi.fn();
    const result = await cleanupExpiredListmonkLists({ fetchImpl });
    expect(result.purged).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('deletes Listmonk lists + nulls snapshot.listmonk_list_id', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [
        { id: 'snap-1', listmonkListId: 42 },
        { id: 'snap-2', listmonkListId: 43 },
      ],
    });
    drizzle.update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{}]),
        then: (cb: (r: unknown) => unknown) => Promise.resolve([{}]).then(cb),
      })),
    })) as never;
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const fetchImpl = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const result = await cleanupExpiredListmonkLists({ fetchImpl });

    expect(result.purged).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('accepts 404 gracefully (list already gone)', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [{ id: 'snap-1', listmonkListId: 42 }],
    });
    drizzle.update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{}]),
        then: (cb: (r: unknown) => unknown) => Promise.resolve([{}]).then(cb),
      })),
    })) as never;
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const fetchImpl = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }));
    const result = await cleanupExpiredListmonkLists({ fetchImpl });
    expect(result.purged).toBe(1);
  });

  it('returns 0 if Listmonk not configured', async () => {
    delete process.env.LISTMONK_INTERNAL_URL;
    const result = await cleanupExpiredListmonkLists();
    expect(result.purged).toBe(0);
  });
});
