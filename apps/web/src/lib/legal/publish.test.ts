/**
 * Tests unitaires — publishLegalPage (4-eyes guard, missing vars,
 * confirm mismatch, not_found, happy path).
 *
 * Mocks : repository (getLegalPageBySlug, listAllTemplateVars), audit,
 * db client (transaction utilisée par le publish).
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
  listAllTemplateVars: vi.fn(),
}));

import { db } from '@/lib/db/client';
import { getLegalPageBySlug, listAllTemplateVars } from '@/lib/legal/repository';
import { publishLegalPage } from './publish';

const BASE_PAGE = {
  id: 'lp_x',
  slug: 'cgv',
  version: 1,
  title: 'CGV',
  description: null,
  bodyMd: '# CGV body',
  status: 'review' as const,
  submittedBy: 'adm_submitter',
  publishedBy: null,
  publishedAt: null,
  canonicalUrl: null,
  includeInSearch: false,
  locale: 'fr-MA' as const,
  requireLegalReview: true,
  updatedAt: new Date(),
  updatedBy: null,
};

const fakeTxConn = {
  transaction: async (fn: (tx: unknown) => Promise<void>) => {
    await fn({
      insert: () => ({ values: async () => undefined }),
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    });
  },
};

beforeEach(() => {
  vi.mocked(getLegalPageBySlug).mockReset();
  vi.mocked(listAllTemplateVars).mockReset();
  vi.mocked(db).mockReturnValue(fakeTxConn as never);
});

describe('publishLegalPage — confirm guard', () => {
  it('refuse si confirm != PUBLIER', async () => {
    const r = await publishLegalPage('cgv', 'publier', 'adm_publisher');
    expect(r).toEqual({ ok: false, code: 'confirm_mismatch' });
    expect(vi.mocked(getLegalPageBySlug)).not.toHaveBeenCalled();
  });
});

describe('publishLegalPage — page not_found', () => {
  it('renvoie not_found si page absente', async () => {
    vi.mocked(getLegalPageBySlug).mockResolvedValue(null);
    const r = await publishLegalPage('inconnue', 'PUBLIER', 'adm_x');
    expect(r).toEqual({ ok: false, code: 'not_found' });
  });
});

describe('publishLegalPage — 4-eyes guard', () => {
  it('REFUSE si publisher == submitter, page en review, requireLegalReview', async () => {
    vi.mocked(getLegalPageBySlug).mockResolvedValue({
      ...BASE_PAGE,
      submittedBy: 'adm_same',
    } as never);
    const r = await publishLegalPage('cgv', 'PUBLIER', 'adm_same');
    expect(r).toEqual({ ok: false, code: 'same_actor' });
  });

  it('ACCEPTE si publisher != submitter', async () => {
    vi.mocked(getLegalPageBySlug).mockResolvedValue({
      ...BASE_PAGE,
      submittedBy: 'adm_submitter',
    } as never);
    vi.mocked(listAllTemplateVars).mockResolvedValue([]);
    const r = await publishLegalPage('cgv', 'PUBLIER', 'adm_different');
    expect(r.ok).toBe(true);
  });

  it('ACCEPTE même same_actor si requireLegalReview=false (FAQ, livraison)', async () => {
    vi.mocked(getLegalPageBySlug).mockResolvedValue({
      ...BASE_PAGE,
      submittedBy: 'adm_same',
      requireLegalReview: false,
    } as never);
    vi.mocked(listAllTemplateVars).mockResolvedValue([]);
    const r = await publishLegalPage('faq', 'PUBLIER', 'adm_same');
    expect(r.ok).toBe(true);
  });

  it('ACCEPTE same_actor si page en draft (jamais soumise)', async () => {
    vi.mocked(getLegalPageBySlug).mockResolvedValue({
      ...BASE_PAGE,
      status: 'draft',
      submittedBy: null,
    } as never);
    vi.mocked(listAllTemplateVars).mockResolvedValue([]);
    const r = await publishLegalPage('cgv', 'PUBLIER', 'adm_same');
    expect(r.ok).toBe(true);
  });
});

describe('publishLegalPage — missing vars', () => {
  it('refuse + retourne missing[] si vars obligatoires non remplies', async () => {
    vi.mocked(getLegalPageBySlug).mockResolvedValue({
      ...BASE_PAGE,
      bodyMd: 'RC : {{COMPANY_RC}}\nICE : {{ICE}}',
      submittedBy: 'other',
    } as never);
    vi.mocked(listAllTemplateVars).mockResolvedValue([
      { key: 'COMPANY_RC', value: '', isRequired: true } as never,
      { key: 'ICE', value: null, isRequired: true } as never,
    ]);
    const r = await publishLegalPage('cgv', 'PUBLIER', 'adm_different');
    expect(r.ok).toBe(false);
    if (!r.ok && r.code === 'missing_required_vars') {
      expect(r.missing.sort()).toEqual(['COMPANY_RC', 'ICE']);
    }
  });
});

describe('publishLegalPage — happy path', () => {
  it('renvoie ok + version bumpée + publishedAt', async () => {
    vi.mocked(getLegalPageBySlug).mockResolvedValue({
      ...BASE_PAGE,
      version: 2,
      submittedBy: 'other',
    } as never);
    vi.mocked(listAllTemplateVars).mockResolvedValue([]);
    const r = await publishLegalPage('cgv', 'PUBLIER', 'adm_publisher');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe(3);
      expect(r.publishedAt).toBeInstanceOf(Date);
    }
  });
});
