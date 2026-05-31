/**
 * Dashboard /admin — section "Pages légales".
 *
 * Vérifie :
 *  - 4 KPIs (Total / Publiées / En revue / Brouillons) avec valeurs DB
 *  - Lien "Voir tout →" vers /admin/legal
 *  - Warning orphelines si pagesWithMissingPlacements > 0
 *  - Tone vert/jaune sur Publiées/En revue/Brouillons selon valeur
 *  - Résilience DB : si legalListStats throw, section affiche zéros
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import type { AdminSession } from '@/lib/auth/session';

const sessionMock: AdminSession = {
  adminId: 'adm_x',
  email: 'a@b.c',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3600_000,
};

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => Promise.resolve(sessionMock),
}));

vi.mock('@/components/admin/AdminShell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/db/queries/leads', () => ({
  listLeads: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
}));

vi.mock('@/lib/db/queries/webhook-endpoints', () => ({
  listWebhookEndpoints: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/db/queries/webhook-deliveries', () => ({
  listDeliveries: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock('@/lib/legal/repository', () => ({
  legalListStats: vi.fn(),
  pagesWithMissingPlacements: vi.fn(),
}));

import AdminDashboardPage from '@/app/admin/page';
import * as repo from '@/lib/legal/repository';

beforeEach(() => {
  vi.mocked(repo.legalListStats).mockReset();
  vi.mocked(repo.pagesWithMissingPlacements).mockReset();
});

afterEach(() => vi.clearAllMocks());

describe('Dashboard — section Pages légales', () => {
  it('affiche les 4 KPIs avec valeurs DB', async () => {
    vi.mocked(repo.legalListStats).mockResolvedValue({
      total: 9,
      published: 5,
      review: 2,
      draft: 1,
      archived: 1,
    });
    vi.mocked(repo.pagesWithMissingPlacements).mockResolvedValue([]);

    const ui = await AdminDashboardPage();
    const { container } = render(ui as React.ReactElement);

    expect(container.textContent).toContain('Pages légales');
    // Les 4 labels présents
    expect(container.textContent).toContain('Total');
    expect(container.textContent).toContain('Publiées');
    expect(container.textContent).toContain('En revue');
    expect(container.textContent).toContain('Brouillons');
    // Les valeurs
    expect(container.innerHTML).toMatch(/>\s*9\s*</);
    expect(container.innerHTML).toMatch(/>\s*5\s*</);
    expect(container.innerHTML).toMatch(/>\s*2\s*</);
  });

  it('lien "Voir tout →" vers /admin/legal', async () => {
    vi.mocked(repo.legalListStats).mockResolvedValue({
      total: 0, published: 0, review: 0, draft: 0, archived: 0,
    });
    vi.mocked(repo.pagesWithMissingPlacements).mockResolvedValue([]);

    const ui = await AdminDashboardPage();
    const { container } = render(ui as React.ReactElement);
    expect(container.innerHTML).toContain('href="/admin/legal"');
    expect(container.textContent).toContain('Voir tout');
  });

  it('warning visible si pagesWithMissingPlacements > 0', async () => {
    vi.mocked(repo.legalListStats).mockResolvedValue({
      total: 9, published: 5, review: 0, draft: 4, archived: 0,
    });
    vi.mocked(repo.pagesWithMissingPlacements).mockResolvedValue(['cgv', 'cookies']);

    const ui = await AdminDashboardPage();
    const { container } = render(ui as React.ReactElement);

    expect(container.textContent).toContain('2 page(s) publiée(s) sans placement');
    expect(container.textContent).toContain('cgv');
    expect(container.textContent).toContain('cookies');
    expect(container.innerHTML).toContain('href="/admin/legal/placements"');
  });

  it('pas de warning si aucune orpheline', async () => {
    vi.mocked(repo.legalListStats).mockResolvedValue({
      total: 9, published: 5, review: 0, draft: 4, archived: 0,
    });
    vi.mocked(repo.pagesWithMissingPlacements).mockResolvedValue([]);

    const ui = await AdminDashboardPage();
    const { container } = render(ui as React.ReactElement);
    expect(container.textContent).not.toContain('sans placement visible');
  });

  it('tone vert sur Publiées si > 0', async () => {
    vi.mocked(repo.legalListStats).mockResolvedValue({
      total: 9, published: 9, review: 0, draft: 0, archived: 0,
    });
    vi.mocked(repo.pagesWithMissingPlacements).mockResolvedValue([]);

    const ui = await AdminDashboardPage();
    const { container } = render(ui as React.ReactElement);
    // La valeur "9" dans le KPI Publiées doit être en text-emerald-700
    expect(container.innerHTML).toMatch(
      /text-emerald-700[^"]*"\s*>\s*9\s*</,
    );
  });

  it('résilience : si legalListStats throw, affiche zéros sans crash', async () => {
    vi.mocked(repo.legalListStats).mockRejectedValue(new Error('DB unavailable'));
    vi.mocked(repo.pagesWithMissingPlacements).mockResolvedValue([]);

    const ui = await AdminDashboardPage();
    const { container } = render(ui as React.ReactElement);
    expect(container.textContent).toContain('Pages légales');
    // 4 zéros (Total/Publiées/En revue/Brouillons)
    const zeros = container.innerHTML.match(/>\s*0\s*</g);
    expect(zeros?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it('résilience : si pagesWithMissingPlacements throw, dashboard rend sans warning', async () => {
    vi.mocked(repo.legalListStats).mockResolvedValue({
      total: 1, published: 1, review: 0, draft: 0, archived: 0,
    });
    vi.mocked(repo.pagesWithMissingPlacements).mockRejectedValue(new Error('DB'));

    const ui = await AdminDashboardPage();
    const { container } = render(ui as React.ReactElement);
    expect(container.textContent).toContain('Pages légales');
    expect(container.textContent).not.toContain('sans placement');
  });

  it('truncation 3 + ellipsis si > 3 orphelines', async () => {
    vi.mocked(repo.legalListStats).mockResolvedValue({
      total: 5, published: 5, review: 0, draft: 0, archived: 0,
    });
    vi.mocked(repo.pagesWithMissingPlacements).mockResolvedValue([
      'a', 'b', 'c', 'd', 'e',
    ]);

    const ui = await AdminDashboardPage();
    const { container } = render(ui as React.ReactElement);
    expect(container.textContent).toContain('5 page(s)');
    expect(container.textContent).toMatch(/a, b, c…/);
    expect(container.textContent).not.toContain('a, b, c, d, e');
  });
});
