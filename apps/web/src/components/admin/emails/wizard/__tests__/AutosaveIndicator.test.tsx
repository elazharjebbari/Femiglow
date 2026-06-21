// @vitest-environment jsdom
/**
 * F05 P3.2-c2 — AutosaveIndicator (présentationnel, layers U + D).
 *
 *  - CMP-AUTO-D-001..005 : mapping statut → libellé + data-status.
 *  - CMP-AUTO-D-006 : à "saved", l'âge court (tick 1 s, honnête).
 *  - CMP-AUTO-D-007 : pas de role status/alert (aria-live seul) → ne collisionne
 *    pas avec les zones live métier de l'écran (verrou a11y G11).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { AutosaveIndicator } from '@/components/admin/emails/wizard/AutosaveIndicator';

afterEach(() => vi.useRealTimers());

describe('F05 — AutosaveIndicator', () => {
  it('CMP-AUTO-D-001 — idle : aucun libellé, data-status="idle"', () => {
    render(<AutosaveIndicator status="idle" savedAt={null} />);
    const el = screen.getByTestId('autosave-status');
    expect(el).toHaveAttribute('data-status', 'idle');
    expect(el).toHaveTextContent('');
  });

  it('CMP-AUTO-D-002 — saving : « Enregistrement… »', () => {
    render(<AutosaveIndicator status="saving" savedAt={null} />);
    expect(screen.getByTestId('autosave-status')).toHaveTextContent('Enregistrement…');
  });

  it('CMP-AUTO-D-003 — saved : « ✓ Enregistré il y a … »', () => {
    vi.useFakeTimers({ now: new Date('2026-06-20T10:00:10.000Z').getTime() });
    render(<AutosaveIndicator status="saved" savedAt="2026-06-20T10:00:00.000Z" />);
    expect(screen.getByTestId('autosave-status')).toHaveTextContent('✓ Enregistré il y a 10 s');
  });

  it('CMP-AUTO-D-004 — error : message d’échec actionnable', () => {
    render(<AutosaveIndicator status="error" savedAt={null} />);
    expect(screen.getByTestId('autosave-status')).toHaveTextContent(/Échec de l’enregistrement/i);
  });

  it('CMP-AUTO-D-005 — conflict : invite à recharger', () => {
    render(<AutosaveIndicator status="conflict" savedAt={null} />);
    expect(screen.getByTestId('autosave-status')).toHaveTextContent(/Conflit/i);
  });

  it('CMP-AUTO-D-006 — à "saved", l’âge court (tick 1 s)', () => {
    vi.useFakeTimers({ now: new Date('2026-06-20T10:00:30.000Z').getTime() });
    render(<AutosaveIndicator status="saved" savedAt="2026-06-20T10:00:00.000Z" />);
    expect(screen.getByTestId('autosave-status')).toHaveTextContent('il y a 30 s');
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByTestId('autosave-status')).toHaveTextContent('il y a 35 s');
  });

  it('CMP-AUTO-D-007 — aria-live SANS role status/alert (pas de collision de role)', () => {
    render(<AutosaveIndicator status="saving" savedAt={null} />);
    const el = screen.getByTestId('autosave-status');
    expect(el).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
