// @vitest-environment jsdom
/**
 * F05 P3.2-c3 — ScheduleShortcuts (chips de planification rapide, layers U + D).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScheduleShortcuts } from '@/components/admin/emails/wizard/ScheduleShortcuts';

const NOW = new Date(2026, 5, 15, 12, 30, 0, 0); // 15 juin 2026, 12:30 local

afterEach(() => vi.clearAllMocks());

describe('F05 — ScheduleShortcuts', () => {
  it('CMP-ASSIST-D-010 — rend les chips usuels (now injecté)', () => {
    render(<ScheduleShortcuts onPick={vi.fn()} now={NOW} />);
    expect(screen.getByRole('button', { name: /Dans 1 heure/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Demain 9 h/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lundi prochain/i })).toBeInTheDocument();
  });

  it('CMP-ASSIST-D-011 — clic sur « Demain 9 h » → onPick(valeur datetime-local)', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<ScheduleShortcuts onPick={onPick} now={NOW} />);
    await user.click(screen.getByRole('button', { name: /Demain 9 h/i }));
    expect(onPick).toHaveBeenCalledWith('2026-06-16T09:00');
  });
});
