/**
 * RTL — ScheduleDialog (P10).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ScheduleDialog, __test } from './ScheduleDialog';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-05T08:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('ScheduleDialog', () => {
  it('ne rend rien quand open=false', () => {
    const { container } = render(
      <ScheduleDialog
        open={false}
        fieldLabel="Titre"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('rend le dialog avec les inputs date/heure et un aperçu lisible', () => {
    render(
      <ScheduleDialog
        open
        fieldLabel="Titre"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Heure')).toBeInTheDocument();
    expect(screen.getByText(/Europe\/Paris/)).toBeInTheDocument();
  });

  it('appelle onCancel sur clic Annuler', () => {
    const cancel = vi.fn();
    render(
      <ScheduleDialog
        open
        fieldLabel="Titre"
        onConfirm={() => {}}
        onCancel={cancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(cancel).toHaveBeenCalled();
  });

  it('refuse une programmation < +1 minute (anti-flap)', () => {
    const confirm = vi.fn();
    render(
      <ScheduleDialog
        open
        fieldLabel="Titre"
        onConfirm={confirm}
        onCancel={() => {}}
      />,
    );
    // Forcer un moment dans le passé.
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2020-01-01' },
    });
    fireEvent.change(screen.getByLabelText('Heure'), {
      target: { value: '12:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Programmer' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/au moins 1 minute/);
  });

  it('appelle onConfirm avec un ISO 8601 quand la date est ≥ +1 min', () => {
    const confirm = vi.fn();
    render(
      <ScheduleDialog
        open
        fieldLabel="Titre"
        onConfirm={confirm}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-05-06' },
    });
    fireEvent.change(screen.getByLabelText('Heure'), {
      target: { value: '09:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Programmer' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    const iso = confirm.mock.calls[0]![0] as string;
    expect(iso).toMatch(/^2026-05-06T07:00:00\.000Z$/); // 09h Paris en mai = UTC+2
  });

  it('Escape ferme la modale (onCancel)', () => {
    const cancel = vi.fn();
    render(
      <ScheduleDialog
        open
        fieldLabel="Titre"
        onConfirm={() => {}}
        onCancel={cancel}
      />,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(cancel).toHaveBeenCalled();
  });

  it('affiche une erreur externe via prop `error`', () => {
    render(
      <ScheduleDialog
        open
        fieldLabel="Titre"
        onConfirm={() => {}}
        onCancel={() => {}}
        error="Conflit côté serveur"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Conflit côté serveur');
  });
});

describe('ScheduleDialog — helpers', () => {
  it('toParisParts retourne YYYY-MM-DD / HH:MM en heure Paris (UTC+2 en mai)', () => {
    // 2026-05-06 09:00 Paris ≡ 2026-05-06 07:00 UTC.
    const d = new Date('2026-05-06T07:00:00Z');
    expect(__test.toParisParts(d)).toEqual({ date: '2026-05-06', time: '09:00' });
  });

  it('fromParisToISO inverse correctement (mai = UTC+2)', () => {
    expect(__test.fromParisToISO('2026-05-06', '09:00')).toBe(
      '2026-05-06T07:00:00.000Z',
    );
  });

  it('fromParisToISO gère l\'hiver (UTC+1 en janvier)', () => {
    expect(__test.fromParisToISO('2026-01-15', '09:00')).toBe(
      '2026-01-15T08:00:00.000Z',
    );
  });
});
