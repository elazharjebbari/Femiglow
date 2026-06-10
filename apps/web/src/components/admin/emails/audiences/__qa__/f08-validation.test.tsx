/**
 * F08 étape 2 — validations UI (AUD-02/05/07/09) :
 *  - between : erreur de borne + « Inverser les bornes » (C-039/040/041),
 *    borne manquante bloque l'étape 2 (C-042) ;
 *  - email_pattern in : chips trim/anti-doublon/vide bloquant (C-047/048/049) ;
 *  - country : bascule in→eq avec ConfirmDialog (C-050..053), code inconnu
 *    bloquant à l'étape 2 (C-054).
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { server, http, HttpResponse } from '@/test/msw/server';
import { RuleEditor } from '../RuleEditor';
import { AudienceWizard } from '../AudienceWizard';
import {
  BETWEEN_ERROR,
  BETWEEN_INCOMPLETE_ERROR,
  EMAIL_PATTERN_IN_EMPTY_ERROR,
} from '../rule-validation';
import type { Rule, RulesGroup } from '@/lib/mail/audiences/rules-types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  server.use(
    http.post('/api/admin/emails/audiences/preview-size', () =>
      HttpResponse.json({ size: 42, durationMs: 10 }),
    ),
    http.post('/api/admin/emails/audiences/preview-breakdown', () =>
      HttpResponse.json({ matched: 50, excluded: 8, deliverable: 42, durationMs: 10 }),
    ),
  );
});

function ControlledRule({ initial, spy }: { initial: Rule; spy?: (r: Rule) => void }) {
  const [rule, setRule] = useState(initial);
  return (
    <RuleEditor
      rule={rule}
      onChange={(r) => {
        setRule(r);
        spy?.(r);
      }}
    />
  );
}

function wizardWith(rules: RulesGroup) {
  return render(
    <AudienceWizard
      mode="edit"
      audienceId="a1"
      initial={{ slug: 'seg', name: 'Segment', rules }}
    />,
  );
}

async function gotoStep2() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('next-btn'));
  });
  expect(screen.getByTestId('exclusion-flags-fieldset')).toBeInTheDocument();
}

async function clickContinuer() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('next-btn'));
  });
}

describe('F08 — between : bornes inversées (AUD-02)', () => {
  it("F08-C-039 — saisir [500, 100] affiche l'erreur de borne role=alert", () => {
    render(
      <ControlledRule
        initial={{ kind: 'order_count', operator: 'between', value: [500, 100] }}
      />,
    );
    const err = screen.getByTestId('between-error');
    expect(err).toHaveAttribute('role', 'alert');
    expect(err.textContent).toContain(BETWEEN_ERROR);
  });

  it("F08-C-040 — « Inverser les bornes » réécrit value=[100, 500] et efface l'erreur", () => {
    const spy = vi.fn();
    render(
      <ControlledRule
        initial={{ kind: 'order_count', operator: 'between', value: [500, 100] }}
        spy={spy}
      />,
    );
    fireEvent.click(screen.getByTestId('swap-bounds'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0]![0] as { value: unknown }).value).toEqual([100, 500]);
    expect(screen.queryByTestId('between-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('num-between-lo')).toHaveValue(100);
    expect(screen.getByTestId('num-between-hi')).toHaveValue(500);
  });

  it("F08-C-041 — created_at between [fin, début] affiche l'erreur de borne (et l'inversion corrige)", () => {
    const spy = vi.fn();
    render(
      <ControlledRule
        initial={{ kind: 'created_at', operator: 'between', value: ['2025-03-01', '2025-01-01'] }}
        spy={spy}
      />,
    );
    expect(screen.getByTestId('between-error')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('swap-bounds'));
    expect((spy.mock.calls[0]![0] as { value: unknown }).value).toEqual([
      '2025-01-01',
      '2025-03-01',
    ]);
    expect(screen.queryByTestId('between-error')).not.toBeInTheDocument();
  });

  it('F08-C-042 — un between avec une borne vide bloque Continuer (message dédié)', async () => {
    wizardWith({
      kind: 'all',
      conditions: [{ kind: 'created_at', operator: 'between', value: ['2025-01-01', ''] }],
    });
    await gotoStep2();
    await clickContinuer();
    expect(screen.getByTestId('rules-error').textContent).toContain(BETWEEN_INCOMPLETE_ERROR);
    expect(screen.queryByText('Récapitulatif')).not.toBeInTheDocument();
  });
});

describe('F08 — email_pattern in : chips (AUD-09)', () => {
  function inRule(values: string[]): Rule {
    return { kind: 'email_pattern', operator: 'in', value: values };
  }

  it("F08-C-047 — une valeur ' foo ' devient chip 'foo' (trimée)", () => {
    const spy = vi.fn();
    render(<ControlledRule initial={inRule([])} spy={spy} />);
    fireEvent.change(screen.getByTestId('pattern-chips-input'), { target: { value: ' foo ' } });
    fireEvent.click(screen.getByTestId('pattern-chips-add'));
    expect(screen.getByTestId('pattern-chip-foo')).toBeInTheDocument();
    expect((spy.mock.calls[0]![0] as { value: unknown }).value).toEqual(['foo']);
  });

  it('F08-C-048 — ajouter une valeur déjà présente ne crée pas de doublon', () => {
    const spy = vi.fn();
    render(<ControlledRule initial={inRule(['foo'])} spy={spy} />);
    fireEvent.change(screen.getByTestId('pattern-chips-input'), { target: { value: 'foo' } });
    fireEvent.click(screen.getByTestId('pattern-chips-add'));
    expect(spy).not.toHaveBeenCalled(); // aucun onChange : la liste est inchangée
    expect(screen.getAllByTestId('pattern-chip-foo')).toHaveLength(1);
  });

  it("F08-C-049 — retirer toutes les chips puis Continuer affiche « Ajoutez au moins une valeur »", async () => {
    wizardWith({ kind: 'all', conditions: [inRule(['foo'])] });
    await gotoStep2();
    fireEvent.click(screen.getByTestId('pattern-chip-remove-foo'));
    expect(screen.getByTestId('pattern-chips-empty')).toBeInTheDocument();
    await clickContinuer();
    expect(screen.getByTestId('rules-error').textContent).toContain(
      EMAIL_PATTERN_IN_EMPTY_ERROR,
    );
  });
});

describe('F08 — country : bascule in↔eq (AUD-05) + code inconnu (AUD-07)', () => {
  function countryIn(codes: string[]): Rule {
    return { kind: 'country', operator: 'in', value: codes };
  }

  function switchOperator(to: 'eq' | 'in') {
    const select = screen.getByLabelText('Opérateur');
    fireEvent.change(select, { target: { value: to } });
  }

  it('F08-C-050 — passer de in [MA, FR, DZ] à eq ouvre un ConfirmDialog « Ne conserver que 🇲🇦 Maroc ? »', () => {
    render(<ControlledRule initial={countryIn(['MA', 'FR', 'DZ'])} />);
    switchOperator('eq');
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Ne conserver que 🇲🇦 Maroc ?')).toBeInTheDocument();
  });

  it('F08-C-051 — Annuler le dialog conserve operator=in et les 3 codes', () => {
    const spy = vi.fn();
    render(<ControlledRule initial={countryIn(['MA', 'FR', 'DZ'])} spy={spy} />);
    switchOperator('eq');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuler' }));
    expect(spy).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Opérateur')).toHaveValue('in');
    for (const code of ['MA', 'FR', 'DZ']) {
      expect(screen.getByTestId(`country-chip-${code}`)).toBeInTheDocument();
    }
  });

  it('F08-C-052 — Confirmer bascule operator=eq, value=MA (1er code)', async () => {
    const spy = vi.fn();
    render(<ControlledRule initial={countryIn(['MA', 'FR', 'DZ'])} spy={spy} />);
    switchOperator('eq');
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Conserver le 1er' }),
      );
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const next = spy.mock.calls[0]![0] as { operator: string; value: unknown };
    expect(next.operator).toBe('eq');
    expect(next.value).toBe('MA');
  });

  it('F08-C-053 — la bascule eq → in est sans perte : aucun dialog, value=[MA]', () => {
    const spy = vi.fn();
    render(
      <ControlledRule initial={{ kind: 'country', operator: 'eq', value: 'MA' }} spy={spy} />,
    );
    switchOperator('in');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const next = spy.mock.calls[0]![0] as { operator: string; value: unknown };
    expect(next.operator).toBe('in');
    expect(next.value).toEqual(['MA']);
  });

  it("F08-C-054 — une audience portant country 'XX' bloque Continuer avec « Code pays inconnu « XX » »", async () => {
    wizardWith({
      kind: 'all',
      conditions: [{ kind: 'country', operator: 'eq', value: 'XX' }],
    });
    await gotoStep2();
    await clickContinuer();
    expect(screen.getByTestId('rules-error').textContent).toContain('Code pays inconnu « XX »');
    expect(screen.queryByText('Récapitulatif')).not.toBeInTheDocument();
  });
});
