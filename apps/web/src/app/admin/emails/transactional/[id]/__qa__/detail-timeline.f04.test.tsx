// @vitest-environment jsdom
/**
 * F04 — détail d'un envoi : timeline PÉDAGOGIQUE (CKP-F13) — batterie
 * F04-C-060..063. Le RSC est monté avec ses lectures DB mockées.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => ({ email: 'admin@femiglow-maroc.com' })),
}));
vi.mock('@/components/admin/AdminShell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/components/admin/emails/cockpit/RetryButton', () => ({
  RetryButton: () => null,
}));

const baseRow = {
  id: 'out_detail01',
  status: 'sent',
  template: 'welcome-rituel',
  templateVersion: 1,
  toEmail: 'salma@exemple.test',
  toName: 'Salma',
  fromEmail: 'bonjour@femiglow-maroc.com',
  replyTo: null,
  subject: 'Bienvenue',
  idempotencyKey: 'idem_1',
  attempts: 1,
  maxAttempts: 5,
  source: 'transactional',
  smtpMessageId: 'msg-1',
  smtpResponse: '250 OK',
  createdAt: new Date('2026-06-09T10:00:00.000Z'),
  deliveredAt: null as Date | null,
  lastError: null,
  htmlSnapshot: null,
  payloadJson: {},
};
const timeline = [
  {
    id: 1,
    ts: new Date('2026-06-09T10:00:05.000Z'),
    type: 'sent',
    source: 'app',
    rawJson: null,
  },
  {
    id: 2,
    ts: new Date('2026-06-09T10:01:00.000Z'),
    type: 'delivered',
    source: 'stalwart',
    rawJson: { event: 'delivery.delivered' },
  },
];

const getOutboxRow = vi.fn(async () => ({ ...baseRow }));
const getOutboxTimeline = vi.fn(async () => timeline);
vi.mock('@/lib/admin/emails/queries', () => ({
  getOutboxRow: (...a: unknown[]) => getOutboxRow(...(a as [])),
  getOutboxTimeline: (...a: unknown[]) => getOutboxTimeline(...(a as [])),
}));

import OutboxDetailPage from '@/app/admin/emails/transactional/[id]/page';

describe('F04 — timeline pédagogique du détail (CKP-F13)', () => {
  it('F04-C-060 — la légende « 📡 webhook Stalwart · ⚙ app » est affichée', async () => {
    render(await OutboxDetailPage({ params: { id: 'out_detail01' } }));
    const legend = screen.getByTestId('timeline-legend');
    expect(legend).toHaveTextContent('webhook Stalwart');
    expect(legend).toHaveTextContent('app');
  });

  it('F04-C-061 — badge source : delivered porte 📡, sent porte ⚙', async () => {
    render(await OutboxDetailPage({ params: { id: 'out_detail01' } }));
    expect(screen.getByTestId('timeline-source-1')).toHaveTextContent('⚙ via app');
    expect(screen.getByTestId('timeline-source-2')).toHaveTextContent('📡 via stalwart');
  });

  it('F04-C-062 — sent STAGNANT (sans delivered) → encart ⓘ boîte locale / webhook muet', async () => {
    getOutboxRow.mockResolvedValueOnce({ ...baseRow, status: 'sent', deliveredAt: null });
    render(await OutboxDetailPage({ params: { id: 'out_detail01' } }));
    const info = screen.getByTestId('sent-stagnant-info');
    expect(info).toHaveTextContent(/boîte locale/i);
    expect(info).toHaveTextContent(/webhook/i);
  });

  it("F04-C-062b — livré : AUCUN encart (pas d'alerte sur un envoi sain)", async () => {
    getOutboxRow.mockResolvedValueOnce({
      ...baseRow,
      status: 'delivered',
      deliveredAt: new Date('2026-06-09T10:01:00.000Z'),
    });
    render(await OutboxDetailPage({ params: { id: 'out_detail01' } }));
    expect(screen.queryByTestId('sent-stagnant-info')).not.toBeInTheDocument();
  });

  it('F04-C-063 — lien retour « ← Transactionnel » collant en pied de page', async () => {
    render(await OutboxDetailPage({ params: { id: 'out_detail01' } }));
    const back = screen.getByTestId('sticky-back-link');
    expect(back).toHaveTextContent('← Transactionnel');
    expect(back).toHaveAttribute('href', '/admin/emails/transactional');
    expect(back.closest('div')?.className).toContain('sticky');
  });

  it('F04-C-063b — a11y : les dates de timeline sont des <time> datés (TZ socle)', async () => {
    render(await OutboxDetailPage({ params: { id: 'out_detail01' } }));
    const times = within(screen.getByText('Timeline').closest('section')!).getAllByRole('time');
    expect(times.length).toBeGreaterThanOrEqual(2);
  });
});
