import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(),
  schema: { legalSlugRedirects: {} },
}));

import { db } from '@/lib/db/client';
import { lookupSlugRedirect } from './redirects';

function conn(rows: unknown[]): unknown {
  return {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => rows }),
      }),
    }),
  };
}

beforeEach(() => {
  vi.mocked(db).mockReset();
});

describe('lookupSlugRedirect', () => {
  it('renvoie le new_slug si trouvé', async () => {
    vi.mocked(db).mockReturnValue(conn([{ newSlug: 'cgv' }]) as never);
    expect(await lookupSlugRedirect('conditions-vente')).toBe('cgv');
  });

  it('renvoie null si aucun match', async () => {
    vi.mocked(db).mockReturnValue(conn([]) as never);
    expect(await lookupSlugRedirect('inconnu')).toBe(null);
  });

  it('renvoie null si db indisponible', async () => {
    vi.mocked(db).mockReturnValue(null);
    expect(await lookupSlugRedirect('x')).toBe(null);
  });

  it('renvoie null sans crasher si la table n\'existe pas (catch)', async () => {
    vi.mocked(db).mockReturnValue({
      select: () => {
        throw new Error('relation does not exist');
      },
    } as never);
    expect(await lookupSlugRedirect('x')).toBe(null);
  });
});
