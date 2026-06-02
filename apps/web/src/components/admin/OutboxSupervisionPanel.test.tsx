/**
 * OWBS F11 — OutboxSupervisionPanel (supervision opérateur de l'outbox).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OutboxSupervisionPanel, type OutboxEffectRow } from './OutboxSupervisionPanel';
import { expectNoAxeViolations } from '@/test/axe';

const DEAD: OutboxEffectRow[] = [
  { id: 'lox_d1', type: 'order_webhook', leadId: 'cl_aaaaaaaaaaaaaaaaaaaa', attempts: 8, lastError: 'CRM 500' },
];

describe('OutboxSupervisionPanel (OWBS F11)', () => {
  it('F11-S01 — affiche les compteurs par statut', () => {
    render(<OutboxSupervisionPanel counts={{ pending: 2, processing: 0, done: 5, dead: 1 }} dead={DEAD} onReplay={vi.fn()} />);
    expect(screen.getByTestId('outbox-count-pending')).toHaveTextContent('2');
    expect(screen.getByTestId('outbox-count-done')).toHaveTextContent('5');
    expect(screen.getByTestId('outbox-count-dead')).toHaveTextContent('1');
  });

  it('F11-S02 — alerte (role=alert) si dead>0', () => {
    render(<OutboxSupervisionPanel counts={{ dead: 1 }} dead={DEAD} onReplay={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveAttribute('data-testid', 'outbox-dead-alert');
    expect(screen.getByTestId('outbox-dead-list')).toBeInTheDocument();
  });

  it('F11-S02b — pas d\'alerte ni de liste si aucun dead', () => {
    render(<OutboxSupervisionPanel counts={{ dead: 0, pending: 1 }} dead={[]} onReplay={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('outbox-empty')).toBeInTheDocument();
  });

  it('F11-S05 — « Rejouer » appelle onReplay avec l\'id', async () => {
    const onReplay = vi.fn();
    render(<OutboxSupervisionPanel counts={{ dead: 1 }} dead={DEAD} onReplay={onReplay} />);
    await userEvent.click(screen.getByTestId('outbox-replay-lox_d1'));
    expect(onReplay).toHaveBeenCalledWith('lox_d1');
  });

  it('F11 — bouton désactivé pendant le rejeu (replayingId)', () => {
    render(<OutboxSupervisionPanel counts={{ dead: 1 }} dead={DEAD} onReplay={vi.fn()} replayingId="lox_d1" />);
    expect(screen.getByTestId('outbox-replay-lox_d1')).toBeDisabled();
  });

  it('F11 — axe 0 violation', async () => {
    const { container } = render(<OutboxSupervisionPanel counts={{ dead: 1 }} dead={DEAD} onReplay={vi.fn()} />);
    await expectNoAxeViolations(container);
  });
});
