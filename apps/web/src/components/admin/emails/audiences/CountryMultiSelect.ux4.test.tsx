/**
 * UX4-AUDIENCES-009 — CountryMultiSelect : chips au lieu du CSV texte-libre.
 *
 * Oracles :
 *  - ajouter un pays depuis la liste fermée → chip + value mise à jour ;
 *  - retirer un pays → value mise à jour ;
 *  - un code pays inconnu (value héritée) est montré en chip d'avertissement
 *    (role=alert) + bandeau — au lieu d'être perdu silencieusement ;
 *  - garde-fou : la liste COUNTRIES locale est alignée code-pour-code sur
 *    COUNTRY_CALLING_CODE du compilateur (sinon un pays « ajoutable » dans l'UI
 *    compile en FALSE → audience vide silencieuse).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CountryMultiSelect } from './CountryMultiSelect';
import { COUNTRIES, isKnownCountry } from './countries';

describe('CountryMultiSelect — UX4-AUDIENCES-009', () => {
  it('F08-C-045 (ex UX4-AUDIENCES-009) — ajoute des pays depuis la liste fermée (chips)', async () => {
    const onChange = vi.fn();
    render(<CountryMultiSelect value={['MA']} onChange={onChange} />);
    expect(screen.getByTestId('country-chip-MA')).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByTestId('country-add-select'), { target: { value: 'FR' } });
    });
    expect(onChange).toHaveBeenCalledWith(['MA', 'FR']);
  });

  it('ne propose pas un pays déjà sélectionné', () => {
    render(<CountryMultiSelect value={['MA']} onChange={vi.fn()} />);
    const select = screen.getByTestId('country-add-select') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).not.toContain('MA');
    expect(values).toContain('FR');
  });

  it('F08-C-046 (ex UX4-AUDIENCES-009) — retire un pays via la chip ✕', async () => {
    const onChange = vi.fn();
    render(<CountryMultiSelect value={['MA', 'FR']} onChange={onChange} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('country-remove-FR'));
    });
    expect(onChange).toHaveBeenCalledWith(['MA']);
  });

  it('signale un code pays inconnu (chip alert + bandeau)', () => {
    render(<CountryMultiSelect value={['MA', 'ZZ']} onChange={vi.fn()} />);
    const badChip = screen.getByTestId('country-chip-ZZ');
    expect(badChip).toHaveAttribute('role', 'alert');
    expect(screen.getByTestId('country-unknown-warning')).toBeInTheDocument();
  });

  it('GARDE-FOU : chaque pays proposé est connu du compilateur (COUNTRY_CALLING_CODE)', () => {
    // Si un pays est ajoutable dans l'UI mais inconnu du compilateur, il
    // compile en FALSE → audience vide silencieuse. On épingle l'alignement.
    for (const c of COUNTRIES) {
      expect(isKnownCountry(c.code)).toBe(true);
    }
  });
});
