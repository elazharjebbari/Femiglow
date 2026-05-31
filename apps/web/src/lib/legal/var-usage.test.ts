import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(),
  schema: { legalPages: {} },
}));

import { db } from '@/lib/db/client';
import { listPagesUsingVar } from './repository';

function conn(rows: unknown[] = []) {
  return {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(rows),
      }),
    }),
  };
}

beforeEach(() => {
  vi.mocked(db).mockReset();
});

describe('listPagesUsingVar', () => {
  it('rejette key invalide → []', async () => {
    expect(await listPagesUsingVar('invalid key')).toEqual([]);
    expect(await listPagesUsingVar('lowerCase')).toEqual([]);
    expect(await listPagesUsingVar('1NUMBER_FIRST')).toEqual([]);
    expect(await listPagesUsingVar('')).toEqual([]);
  });

  it('accepte key valide A-Z_0-9', async () => {
    vi.mocked(db).mockReturnValue(
      conn([{ slug: 'cgv' }, { slug: 'cookies' }]) as never,
    );
    const r = await listPagesUsingVar('COMPANY_RC');
    expect(r).toEqual(['cgv', 'cookies']);
  });

  it('renvoie [] si aucune page n\'utilise la var', async () => {
    vi.mocked(db).mockReturnValue(conn([]) as never);
    const r = await listPagesUsingVar('NEVER_USED');
    expect(r).toEqual([]);
  });
});
