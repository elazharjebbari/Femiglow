/**
 * Tests intégration — /admin/legal page server component avec
 * searchParams ?status= ?q=.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import type { AdminSession } from '@/lib/auth/session';

const sessionMock: AdminSession = {
  adminId: 'adm_l',
  email: 'l@x',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3600_000,
};

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => Promise.resolve(sessionMock),
}));

vi.mock('@/components/admin/AdminShell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/admin/legal/LegalListFilters', () => ({
  LegalListFilters: () => <div data-testid="filters" />,
}));

vi.mock('@/lib/legal/repository', () => ({
  listLegalPages: vi.fn(),
  legalListStats: vi.fn().mockResolvedValue({
    total: 0, draft: 0, review: 0, published: 0, archived: 0,
  }),
  listAllTemplateVars: vi.fn().mockResolvedValue([]),
}));

import * as repo from '@/lib/legal/repository';
import AdminLegalPage from '@/app/admin/legal/page';

beforeEach(() => {
  vi.mocked(repo.listLegalPages).mockReset();
});

describe('/admin/legal — filtrage searchParams', () => {
  it('sans searchParams → listLegalPages({}) appelé', async () => {
    vi.mocked(repo.listLegalPages).mockResolvedValue([]);
    await AdminLegalPage({});
    expect(repo.listLegalPages).toHaveBeenCalledWith({
      status: undefined,
      search: undefined,
    });
  });

  it('?status=draft → listLegalPages({ status: "draft" })', async () => {
    vi.mocked(repo.listLegalPages).mockResolvedValue([]);
    await AdminLegalPage({ searchParams: { status: 'draft' } });
    expect(repo.listLegalPages).toHaveBeenCalledWith({
      status: 'draft',
      search: undefined,
    });
  });

  it('?status=INVALID → ignoré (status=undefined)', async () => {
    vi.mocked(repo.listLegalPages).mockResolvedValue([]);
    await AdminLegalPage({ searchParams: { status: 'pending' } });
    expect(repo.listLegalPages).toHaveBeenCalledWith({
      status: undefined,
      search: undefined,
    });
  });

  it('?q=cgv → listLegalPages({ search: "cgv" })', async () => {
    vi.mocked(repo.listLegalPages).mockResolvedValue([]);
    await AdminLegalPage({ searchParams: { q: 'cgv' } });
    expect(repo.listLegalPages).toHaveBeenCalledWith({
      status: undefined,
      search: 'cgv',
    });
  });

  it('?q=&status= (vides) → tous undefined', async () => {
    vi.mocked(repo.listLegalPages).mockResolvedValue([]);
    await AdminLegalPage({ searchParams: { q: '', status: '' } });
    expect(repo.listLegalPages).toHaveBeenCalledWith({
      status: undefined,
      search: undefined,
    });
  });

  it('résultat vide avec filtres → empty state "Aucun résultat"', async () => {
    vi.mocked(repo.listLegalPages).mockResolvedValue([]);
    const ui = await AdminLegalPage({ searchParams: { q: 'inexistant' } });
    const { container } = render(ui as React.ReactElement);
    expect(container.textContent).toContain('Aucun résultat');
    expect(container.innerHTML).toContain('Effacer les filtres');
  });

  it('résultat vide sans filtre → empty state "Aucune page légale" (différent CTA)', async () => {
    vi.mocked(repo.listLegalPages).mockResolvedValue([]);
    const ui = await AdminLegalPage({});
    const { container } = render(ui as React.ReactElement);
    expect(container.textContent).toContain('Aucune page légale');
    expect(container.innerHTML).toContain('Créer une page');
  });

  it('résultat vide avec status filter → label statut dans le message', async () => {
    vi.mocked(repo.listLegalPages).mockResolvedValue([]);
    const ui = await AdminLegalPage({ searchParams: { status: 'review' } });
    const { container } = render(ui as React.ReactElement);
    expect(container.textContent).toContain('statut: review');
  });
});
