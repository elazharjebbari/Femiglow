import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@/lib/errors/http-error';
import { MediaSetConflictError, getSetWithItems } from '@/lib/db/queries/component-media-sets';
import { toMediaSetHttpError } from './route-helpers';

vi.mock('@/lib/db/queries/component-media-sets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/queries/component-media-sets')>()),
  getSetWithItems: vi.fn(),
}));

const set = { id: 'cms_1', updatedAt: new Date('2026-10-30T08:00:00.000Z') } as unknown as ConstructorParameters<
  typeof MediaSetConflictError
>[0];

describe('toMediaSetHttpError — conflit de version', () => {
  beforeEach(() => vi.mocked(getSetWithItems).mockReset());

  it('état courant relu avec ses items', async () => {
    const current = { ...set!, items: [] };
    vi.mocked(getSetWithItems).mockResolvedValue(current as never);
    const err = (await toMediaSetHttpError(new MediaSetConflictError(set))) as HttpError;
    expect(err.details).toEqual({ current, remoteUpdatedAt: '2026-10-30T08:00:00.000Z' });
  });

  it('ensemble non relu : `current` null, jamais l’ensemble sans items', async () => {
    vi.mocked(getSetWithItems).mockResolvedValue(null as never);
    const err = (await toMediaSetHttpError(new MediaSetConflictError(set))) as HttpError;
    expect(err.details).toEqual({ current: null, remoteUpdatedAt: '2026-10-30T08:00:00.000Z' });
  });
});
