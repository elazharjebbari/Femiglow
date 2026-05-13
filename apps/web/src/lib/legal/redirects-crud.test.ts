import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(),
  schema: { legalSlugRedirects: {} },
}));

import { db } from '@/lib/db/client';
import { createSlugRedirect, deleteSlugRedirect, listSlugRedirects } from './redirects';

function conn(opts: {
  selectRows?: unknown[];
  insertRows?: unknown[];
  deleteRowCount?: number;
  insertThrow?: Error;
  deleteThrow?: Error;
} = {}): unknown {
  return {
    select: () => ({
      from: () => ({
        orderBy: async () => opts.selectRows ?? [],
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: async () => {
          if (opts.insertThrow) throw opts.insertThrow;
          return opts.insertRows ?? [];
        },
      }),
    }),
    delete: () => ({
      where: async () => {
        if (opts.deleteThrow) throw opts.deleteThrow;
        return { rowCount: opts.deleteRowCount ?? 1 };
      },
    }),
  };
}

beforeEach(() => {
  vi.mocked(db).mockReset();
});

describe('listSlugRedirects', () => {
  it('renvoie [] si DB indisponible', async () => {
    vi.mocked(db).mockReturnValue(null);
    expect(await listSlugRedirects()).toEqual([]);
  });

  it('renvoie [] et ne crash pas si la table n\'existe pas', async () => {
    vi.mocked(db).mockReturnValue({
      select: () => {
        throw new Error('relation legal_slug_redirects does not exist');
      },
    } as never);
    expect(await listSlugRedirects()).toEqual([]);
  });

  it('renvoie les rows triées par createdAt desc', async () => {
    const rows = [
      { oldSlug: 'a', newSlug: 'b', createdAt: new Date(), createdBy: null },
    ];
    vi.mocked(db).mockReturnValue(conn({ selectRows: rows }) as never);
    expect(await listSlugRedirects()).toEqual(rows);
  });
});

describe('createSlugRedirect', () => {
  it('refuse si oldSlug === newSlug (identical)', async () => {
    const r = await createSlugRedirect({
      oldSlug: 'cgv',
      newSlug: 'cgv',
      actorId: 'adm_x',
    });
    expect(r).toEqual({ ok: false, reason: 'identical' });
  });

  it('renvoie db_error si pas de conn', async () => {
    vi.mocked(db).mockReturnValue(null);
    const r = await createSlugRedirect({
      oldSlug: 'a',
      newSlug: 'b',
      actorId: 'x',
    });
    expect(r).toEqual({ ok: false, reason: 'db_error' });
  });

  it('insert OK retourne ok: true + row', async () => {
    const row = {
      oldSlug: 'old',
      newSlug: 'new',
      createdAt: new Date(),
      createdBy: 'x',
    };
    vi.mocked(db).mockReturnValue(conn({ insertRows: [row] }) as never);
    const r = await createSlugRedirect({ oldSlug: 'old', newSlug: 'new', actorId: 'x' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.row).toEqual(row);
  });

  it('renvoie duplicate sur unique violation', async () => {
    vi.mocked(db).mockReturnValue(
      conn({ insertThrow: new Error('duplicate key value violates unique constraint') }) as never,
    );
    const r = await createSlugRedirect({ oldSlug: 'a', newSlug: 'b', actorId: 'x' });
    expect(r).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('renvoie db_error sur erreur générique', async () => {
    vi.mocked(db).mockReturnValue(
      conn({ insertThrow: new Error('connection lost') }) as never,
    );
    const r = await createSlugRedirect({ oldSlug: 'a', newSlug: 'b', actorId: 'x' });
    expect(r).toEqual({ ok: false, reason: 'db_error' });
  });

  it('renvoie db_error si insert ne retourne pas de row', async () => {
    vi.mocked(db).mockReturnValue(conn({ insertRows: [] }) as never);
    const r = await createSlugRedirect({ oldSlug: 'a', newSlug: 'b', actorId: 'x' });
    expect(r).toEqual({ ok: false, reason: 'db_error' });
  });
});

describe('deleteSlugRedirect', () => {
  it('renvoie false si DB indisponible', async () => {
    vi.mocked(db).mockReturnValue(null);
    expect(await deleteSlugRedirect('a')).toBe(false);
  });

  it('renvoie true si rowCount > 0', async () => {
    vi.mocked(db).mockReturnValue(conn({ deleteRowCount: 1 }) as never);
    expect(await deleteSlugRedirect('a')).toBe(true);
  });

  it('renvoie false si rowCount === 0', async () => {
    vi.mocked(db).mockReturnValue(conn({ deleteRowCount: 0 }) as never);
    expect(await deleteSlugRedirect('a')).toBe(false);
  });

  it('renvoie false sur erreur DB (catch)', async () => {
    vi.mocked(db).mockReturnValue(
      conn({ deleteThrow: new Error('connection lost') }) as never,
    );
    expect(await deleteSlugRedirect('a')).toBe(false);
  });
});
