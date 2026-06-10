// @vitest-environment jsdom
/**
 * F03 — page RSC /admin/emails fenêtrée : batterie F03-C-003/004 (la fenêtre
 * de l'URL pilote données ET liens), F03-C-036..039 (EmptyState socle),
 * F03-C-046 (axe smoke page montée).
 *
 * Pattern p0-quickwins : on monte le Server Component avec ses lectures DB
 * mockées ; KpiCards / WindowSelector / EmptyState restent RÉELS.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => ({ email: 'admin@femiglow-maroc.com' })),
}));

const getOutboxKpiForWindow = vi.fn(async () => ({
  total: 100,
  sent: 42,
  delivered: 38,
  failed: 3,
  dlq: 2,
  pendingNow: 12,
}));
const listRecentOutbox = vi.fn(async (): Promise<unknown[]> => []);
vi.mock('@/lib/admin/emails/queries', () => ({
  getOutboxKpiForWindow: (...a: unknown[]) => getOutboxKpiForWindow(...(a as [])),
  listRecentOutbox: (...a: unknown[]) => listRecentOutbox(...(a as [])),
}));

const summarizeOutbox = vi.fn(async (w: string) => ({
  window: w,
  delivered: 38,
  queued: 2,
  failed: 3,
  hardBounced: 0,
  sent: 42,
  webhookLastSuccessAt: '2026-06-01T10:00:00.000Z',
  sparkline: [],
  comparison: { deliveredPct: 12, failedPct: 0 },
}));
vi.mock('@/lib/mail/transactional/summary', () => ({
  summarizeOutbox: (...a: unknown[]) => summarizeOutbox(...(a as [string])),
}));

vi.mock('@/lib/admin/emails/health', () => ({
  checkEmailingHealth: vi.fn(async () => ({
    level: 'ok',
    timestamp: '2026-06-10T10:00:00.000Z',
    checks: { db: { ok: false } },
  })),
}));
vi.mock('@/lib/db/client', () => ({ db: () => null }));
vi.mock('@/app/api/admin/emails/health/checks', () => ({
  checkEmailingInfraHealth: vi.fn(async () => ({ level: 'ok', checks: {} })),
}));
vi.mock('@/components/admin/AdminShell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/components/admin/emails/HealthBadge', () => ({ HealthBadge: () => null }));
vi.mock('@/components/admin/emails/DashboardAutoRefresh', () => ({
  DashboardAutoRefresh: () => null,
}));

import AdminEmailsPage from '@/app/admin/emails/page';
import { WINDOW_MS } from '@/app/admin/emails/kpi-format';

afterEach(() => vi.clearAllMocks());

describe('F03 — la fenêtre URL pilote la page', () => {
  it('F03-C-003 — ?window=24h : les lectures partent en 24h et les cartes l’affichent', async () => {
    render(await AdminEmailsPage({ searchParams: { window: '24h' } }));
    expect(getOutboxKpiForWindow).toHaveBeenCalledWith(WINDOW_MS['24h']);
    expect(summarizeOutbox).toHaveBeenCalledWith('24h');
    expect(screen.getByText('Envoyés (24 h)')).toBeInTheDocument();
  });

  it('F03-C-004 — les hrefs des cartes portent &window=24h', async () => {
    render(await AdminEmailsPage({ searchParams: { window: '24h' } }));
    const failed = screen.getByTestId('kpi-card-failed').closest('a');
    expect(failed?.getAttribute('href')).toContain('&window=24h');
    const dlq = screen.getByTestId('kpi-card-dlq').closest('a');
    expect(dlq?.getAttribute('href')).toContain('&window=24h');
  });

  it('F03-C-003b — fenêtre invalide → repli 7d silencieux (jamais d’erreur)', async () => {
    render(await AdminEmailsPage({ searchParams: { window: 'bogus' } }));
    expect(summarizeOutbox).toHaveBeenCalledWith('7d');
    expect(screen.getByText('Envoyés (7 j)')).toBeInTheDocument();
  });
});

describe('F03 — EmptyState de la table Derniers envois', () => {
  it('F03-C-036 — recent=[] → EmptyState socle rendu (plus de tr legacy)', async () => {
    render(await AdminEmailsPage({ searchParams: { window: '7d' } }));
    expect(screen.getByRole('status')).toBeInTheDocument();
    // Plus de <tr> legacy « Aucun envoi sur la période ».
    expect(screen.queryByText(/aucun envoi sur la période/i)).not.toBeInTheDocument();
  });

  it('F03-C-037 — le titre de l’EmptyState nomme la fenêtre explicitement', async () => {
    render(await AdminEmailsPage({ searchParams: { window: '7d' } }));
    expect(screen.getByRole('status')).toHaveTextContent('Aucun envoi sur 7 j');
  });

  it('F03-C-038 — le CTA « Ouvrir le cockpit » propage la fenêtre', async () => {
    render(await AdminEmailsPage({ searchParams: { window: '30d' } }));
    const cta = within(screen.getByRole('status')).getByRole('link', {
      name: /ouvrir le cockpit/i,
    });
    expect(cta).toHaveAttribute('href', '/admin/emails/transactional?window=30d');
  });

  it('F03-C-045 — la table consomme le Pill socle : libellé « Bounce permanent » complet', async () => {
    listRecentOutbox.mockResolvedValueOnce([
      {
        id: 'out_bp',
        template: 'welcome-rituel',
        toEmail: 'bp@exemple.test',
        toName: 'B',
        subject: 's',
        status: 'bounced_permanent',
        attempts: 5,
        maxAttempts: 5,
        smtpMessageId: null,
        lastError: null,
        source: 'transactional',
        createdAt: new Date('2026-06-09T10:00:00.000Z'),
        deliveredAt: null,
      },
    ]);
    render(await AdminEmailsPage({ searchParams: {} }));
    expect(screen.getByText('Bounce permanent')).toBeInTheDocument();
    expect(screen.queryByText('Bounce perm.')).not.toBeInTheDocument();
  });

  it('F03-C-039 — recent non vide → table rendue, EmptyState absent', async () => {
    listRecentOutbox.mockResolvedValueOnce([
      {
        id: 'out_1',
        template: 'welcome-rituel',
        toEmail: 'a@exemple.test',
        toName: 'A',
        subject: 's',
        status: 'delivered',
        attempts: 1,
        maxAttempts: 5,
        smtpMessageId: null,
        lastError: null,
        source: 'transactional',
        createdAt: new Date('2026-06-09T10:00:00.000Z'),
        deliveredAt: null,
      },
    ]);
    render(await AdminEmailsPage({ searchParams: {} }));
    expect(screen.queryByText(/aucun envoi sur/i)).not.toBeInTheDocument();
    expect(screen.getByText('a@exemple.test')).toBeInTheDocument();
  });
});

describe('F03 — a11y', () => {
  it('F03-C-046 — axe smoke : 0 violation serious/critical sur le dashboard monté', async () => {
    const { expectNoAxeViolations } = await import('@/test/axe');
    const { container } = render(await AdminEmailsPage({ searchParams: {} }));
    await expectNoAxeViolations(container);
  });
});
