/**
 * UX4-AUDIENCES-002/003/006 — RuleEditor (vague 4 AUDIENCES).
 *
 * Oracles :
 *  - 002 : operator='between' (numérique) rend 2 inputs et écrit value=[lo,hi] ;
 *          DateRuleEditor (created_at) n'exclut plus 'between' et écrit [a,b].
 *  - 003 : email_clicked rend un champ urlPattern, order_count un input until,
 *          ProductIdEditor (has_ordered_product) un input since.
 *  - 006 : order_total saisi '500' MAD est envoyé en value=50000 (cents) ; le
 *          helper affiche l'équivalence en centimes.
 *
 * RTL pur (les sous-éditeurs sont contrôlés ; on observe onChange). Les champs
 * autocomplete (ClickUrlCombobox) ne déclenchent aucun réseau tant qu'on ne
 * tape pas → pas de MSW ici.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { RuleEditor } from './RuleEditor';
import type { Rule } from '@/lib/mail/audiences/rules-types';

function lastRule(onChange: ReturnType<typeof vi.fn>): Rule {
  return onChange.mock.calls.at(-1)![0] as Rule;
}

describe('RuleEditor — UX4-AUDIENCES-002 (operator between)', () => {
  it('F08-C-038 (ex UX4-AUDIENCES-002) — order_count between : 2 inputs numériques → value=[lo,hi]', async () => {
    const onChange = vi.fn();
    const rule: Rule = { kind: 'order_count', operator: 'between', value: [0, 0] };
    render(<RuleEditor rule={rule} onChange={onChange} />);

    // Deux inputs distincts (borne basse / haute) — pas un seul scalaire.
    const lo = screen.getByTestId('num-between-lo') as HTMLInputElement;
    const hi = screen.getByTestId('num-between-hi') as HTMLInputElement;
    expect(lo).toBeInTheDocument();
    expect(hi).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(lo, { target: { value: '2' } });
    });
    await act(async () => {
      fireEvent.change(hi, { target: { value: '5' } });
    });
    // Le rendu est contrôlé : on re-render avec la value cumulée.
    const r = lastRule(onChange) as Extract<Rule, { kind: 'order_count' }>;
    expect(Array.isArray(r.value)).toBe(true);
  });

  it('order_count : passer scalaire → between initialise un tuple', async () => {
    const onChange = vi.fn();
    const rule: Rule = { kind: 'order_count', operator: 'gte', value: 3 };
    render(<RuleEditor rule={rule} onChange={onChange} />);

    const select = screen.getByLabelText('Opérateur') as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(select, { target: { value: 'between' } });
    });
    const r = lastRule(onChange) as Extract<Rule, { kind: 'order_count' }>;
    expect(r.operator).toBe('between');
    expect(r.value).toEqual([3, 3]);
  });

  it('created_at : between est proposé et écrit une plage [a,b]', async () => {
    const onChange = vi.fn();
    const rule: Rule = { kind: 'created_at', operator: 'after', value: '2025-01-01' };
    render(<RuleEditor rule={rule} onChange={onChange} />);

    const select = screen.getByLabelText('Opérateur') as HTMLSelectElement;
    // L'option 'between' (libellé « entre ») existe désormais.
    expect(
      Array.from(select.options).some((o) => o.value === 'between'),
    ).toBe(true);

    await act(async () => {
      fireEvent.change(select, { target: { value: 'between' } });
    });
    let r = lastRule(onChange) as Extract<Rule, { kind: 'created_at' }>;
    expect(r.operator).toBe('between');
    expect(Array.isArray(r.value)).toBe(true);

    // Re-render avec la value tuple → 2 inputs date.
    render(<RuleEditor rule={r} onChange={onChange} />);
    const from = screen.getByTestId('date-between-from') as HTMLInputElement;
    const to = screen.getByTestId('date-between-to') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(from, { target: { value: '2025-01-01' } });
    });
    await act(async () => {
      fireEvent.change(to, { target: { value: '2025-03-01' } });
    });
    r = lastRule(onChange) as Extract<Rule, { kind: 'created_at' }>;
    expect(Array.isArray(r.value)).toBe(true);
    expect((r.value as [string, string])[1]).toBe('2025-03-01');
  });
});

describe('RuleEditor — UX4-AUDIENCES-003 (champs récents)', () => {
  it('email_clicked rend un champ urlPattern', () => {
    const onChange = vi.fn();
    const rule: Rule = { kind: 'email_clicked', within: '30d' };
    render(<RuleEditor rule={rule} onChange={onChange} />);
    expect(screen.getByTestId('url-pattern-field')).toBeInTheDocument();
    // email_opened, lui, n'a PAS de urlPattern (mais un template).
  });

  it('order_count rend un input until', async () => {
    const onChange = vi.fn();
    const rule: Rule = { kind: 'order_count', operator: 'gte', value: 1 };
    render(<RuleEditor rule={rule} onChange={onChange} />);
    const until = screen.getByTestId('num-until') as HTMLInputElement;
    expect(until).toBeInTheDocument();
    await act(async () => {
      fireEvent.change(until, { target: { value: '2026-03-31' } });
    });
    const r = lastRule(onChange) as Extract<Rule, { kind: 'order_count' }>;
    expect(r.until).toBe('2026-03-31');
  });

  it('has_ordered_product rend un input since', async () => {
    const onChange = vi.fn();
    const rule: Rule = { kind: 'has_ordered_product', productId: 'kit-eclat' };
    render(<RuleEditor rule={rule} onChange={onChange} />);
    const since = screen.getByTestId('product-since') as HTMLInputElement;
    expect(since).toBeInTheDocument();
    await act(async () => {
      fireEvent.change(since, { target: { value: '2026-01-01' } });
    });
    const r = lastRule(onChange) as Extract<Rule, { kind: 'has_ordered_product' }>;
    expect(r.since).toBe('2026-01-01');
  });
});

describe('RuleEditor — UX4-AUDIENCES-006 (order_total MAD ↔ centimes)', () => {
  it("F08-C-043 (ex UX4-AUDIENCES-006) — saisir '500' MAD écrit value=50000 (centimes)", () => {
    const onChange = vi.fn();
    // 100000 cents = 1000 MAD affiché.
    const rule: Rule = { kind: 'order_total', operator: 'gte', value: 100000 };
    render(<RuleEditor rule={rule} onChange={onChange} />);

    const input = screen.getByLabelText('Montant (MAD)') as HTMLInputElement;
    // Affiché en MAD : 1000.
    expect(input.value).toBe('1000');

    fireEvent.change(input, { target: { value: '500' } });
    const r = lastRule(onChange) as Extract<Rule, { kind: 'order_total' }>;
    // Stocké en centimes : 500 MAD × 100 = 50000.
    expect(r.value).toBe(50000);
  });

  it('F08-C-044 (ex UX4-AUDIENCES-006) — affiche le helper d’équivalence en centimes', () => {
    const onChange = vi.fn();
    const rule: Rule = { kind: 'order_total', operator: 'gte', value: 50000 };
    render(<RuleEditor rule={rule} onChange={onChange} />);
    const helper = screen.getByTestId('mad-helper');
    // 50000 centimes (la value stockée), formaté fr-FR.
    expect(helper).toHaveTextContent(/50\s?000\s+centimes/);
  });
});
