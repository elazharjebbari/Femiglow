/**
 * Test publish — comportement transactionnel.
 *
 * `publishLegalPage` exécute INSERT history + UPDATE page dans `tx`. Si
 * l'INSERT échoue, l'UPDATE ne doit pas commit non plus → l'erreur
 * remonte et la page reste en `review`/`draft`. Si l'UPDATE échoue après
 * un INSERT réussi, idem : rollback de tout.
 *
 * On simule via un fake `db()` qui transmet une transaction custom où
 * insert OU update peut throw.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(),
  schema: { legalPages: {}, legalPagesHistory: {} },
}));

vi.mock('@/lib/ids', () => ({
  createId: (p: string) => `${p}_test`,
}));

vi.mock('@/lib/legal/audit', () => ({
  logLegalEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/legal/repository', () => ({
  getLegalPageBySlug: vi.fn(),
  listAllTemplateVars: vi.fn().mockResolvedValue([]),
}));

import { db } from '@/lib/db/client';
import { getLegalPageBySlug } from '@/lib/legal/repository';
import { logLegalEvent } from '@/lib/legal/audit';
import { publishLegalPage } from './publish';

const FIXTURE_PAGE = {
  id: 'lp_x',
  slug: 'cgv',
  version: 1,
  title: 'CGV',
  description: null,
  bodyMd: '# body',
  status: 'draft' as const,
  submittedBy: null,
  publishedBy: null,
  publishedAt: null,
  canonicalUrl: null,
  includeInSearch: false,
  locale: 'fr-MA' as const,
  requireLegalReview: true,
  updatedAt: new Date(),
  updatedBy: null,
};

beforeEach(() => {
  vi.mocked(getLegalPageBySlug).mockReset();
  vi.mocked(db).mockReset();
  vi.mocked(logLegalEvent).mockClear();
});

describe('publishLegalPage — rollback transaction', () => {
  it('INSERT history fail → throws, pas d\'audit, page intacte (via mock conn)', async () => {
    vi.mocked(getLegalPageBySlug).mockResolvedValue(FIXTURE_PAGE as never);

    let pageUpdateCalled = false;
    vi.mocked(db).mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<void>) => {
        await fn({
          insert: () => ({
            values: async () => {
              throw new Error('history insert failed (FK violation)');
            },
          }),
          update: () => ({
            set: () => ({
              where: async () => {
                pageUpdateCalled = true;
              },
            }),
          }),
        });
      },
    } as never);

    await expect(publishLegalPage('cgv', 'PUBLIER', 'adm_x')).rejects.toThrow(
      /history insert failed/,
    );
    expect(pageUpdateCalled).toBe(false);
    expect(vi.mocked(logLegalEvent)).not.toHaveBeenCalled();
  });

  it('UPDATE page fail après INSERT réussi → throws, audit pas appelé', async () => {
    vi.mocked(getLegalPageBySlug).mockResolvedValue(FIXTURE_PAGE as never);

    let historyInserted = false;
    vi.mocked(db).mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<void>) => {
        // Dans une vraie transaction Postgres, cette exception
        // déclencherait un rollback automatique. Côté mock, on simule
        // simplement le throw et l'audit ne doit pas être appelé.
        await fn({
          insert: () => ({
            values: async () => {
              historyInserted = true;
            },
          }),
          update: () => ({
            set: () => ({
              where: async () => {
                throw new Error('update page failed');
              },
            }),
          }),
        });
      },
    } as never);

    await expect(publishLegalPage('cgv', 'PUBLIER', 'adm_x')).rejects.toThrow(
      /update page failed/,
    );
    expect(historyInserted).toBe(true); // l'INSERT a tourné côté code
    expect(vi.mocked(logLegalEvent)).not.toHaveBeenCalled();
  });

  it('happy path — INSERT + UPDATE OK → audit appelé + version bumpée', async () => {
    vi.mocked(getLegalPageBySlug).mockResolvedValue({
      ...FIXTURE_PAGE,
      version: 5,
    } as never);

    vi.mocked(db).mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<void>) => {
        await fn({
          insert: () => ({ values: async () => undefined }),
          update: () => ({ set: () => ({ where: async () => undefined }) }),
        });
      },
    } as never);

    const r = await publishLegalPage('cgv', 'PUBLIER', 'adm_x');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe(6);
    expect(vi.mocked(logLegalEvent)).toHaveBeenCalledWith(
      'legal.page.published',
      'adm_x',
      'lp_x',
      expect.objectContaining({ slug: 'cgv', version: 6 }),
    );
  });

  it('si DATABASE_URL manquant → throws explicite', async () => {
    vi.mocked(getLegalPageBySlug).mockResolvedValue(FIXTURE_PAGE as never);
    vi.mocked(db).mockReturnValue(null);

    await expect(publishLegalPage('cgv', 'PUBLIER', 'adm_x')).rejects.toThrow(
      /DATABASE_URL/,
    );
  });

  it('si page introuvable → not_found (pas de transaction tentée)', async () => {
    vi.mocked(getLegalPageBySlug).mockResolvedValue(null);
    const transactionSpy = vi.fn();
    vi.mocked(db).mockReturnValue({ transaction: transactionSpy } as never);

    const r = await publishLegalPage('inconnue', 'PUBLIER', 'adm_x');
    expect(r).toEqual({ ok: false, code: 'not_found' });
    expect(transactionSpy).not.toHaveBeenCalled();
  });

  it('si missing_required_vars → pas de transaction tentée', async () => {
    vi.mocked(getLegalPageBySlug).mockResolvedValue({
      ...FIXTURE_PAGE,
      bodyMd: 'RC : {{COMPANY_RC}}',
    } as never);
    const { listAllTemplateVars } = await import('@/lib/legal/repository');
    vi.mocked(listAllTemplateVars).mockResolvedValue([
      { key: 'COMPANY_RC', value: '', isRequired: true } as never,
    ]);
    const transactionSpy = vi.fn();
    vi.mocked(db).mockReturnValue({ transaction: transactionSpy } as never);

    const r = await publishLegalPage('cgv', 'PUBLIER', 'adm_x');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('missing_required_vars');
    expect(transactionSpy).not.toHaveBeenCalled();
  });
});
