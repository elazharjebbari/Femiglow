/**
 * Tests `PhoneMaskInput` — masque téléphone live FR.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { PhoneMaskInput } from './PhoneMaskInput';

afterEach(() => cleanup());

describe('PhoneMaskInput', () => {
  it('affiche valeur masquée à l\'init si value non vide', () => {
    render(
      <PhoneMaskInput
        id="phone"
        label="Téléphone"
        value="0612345678"
        onChange={() => undefined}
      />,
    );
    const input = screen.getByLabelText(/Téléphone/) as HTMLInputElement;
    expect(input.value).toBe('06 12 34 56 78');
  });

  it('formate live au change : 0612345678 → 06 12 34 56 78', () => {
    const onChange = vi.fn();
    render(<PhoneMaskInput id="phone" label="Téléphone" onChange={onChange} />);
    const input = screen.getByLabelText(/Téléphone/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0612345678' } });
    expect(input.value).toBe('06 12 34 56 78');
  });

  it('renvoie la valeur RAW (sans espaces) au onChange parent', () => {
    // Capture la valeur DANS le callback (sync), pas après le state update.
    let capturedValueAtCallback: string | undefined;
    const onChange = vi.fn((e: { target: { value: string } }) => {
      capturedValueAtCallback = e.target.value;
    });
    render(<PhoneMaskInput id="phone" label="Téléphone" onChange={onChange} />);
    const input = screen.getByLabelText(/Téléphone/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0612345678' } });
    expect(onChange).toHaveBeenCalled();
    // Au moment du callback, e.target.value a été override en RAW (10 chiffres).
    expect(capturedValueAtCallback).toBe('0612345678');
  });

  it('tronque à 10 digits si l\'utilisateur tape 11', () => {
    const onChange = vi.fn();
    render(<PhoneMaskInput id="phone" label="Téléphone" onChange={onChange} />);
    const input = screen.getByLabelText(/Téléphone/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '06123456789' } });
    expect(input.value).toBe('06 12 34 56 78');
  });

  it('strip caractères non-numériques', () => {
    const onChange = vi.fn();
    render(<PhoneMaskInput id="phone" label="Téléphone" onChange={onChange} />);
    const input = screen.getByLabelText(/Téléphone/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '06-12.34/56 78' } });
    expect(input.value).toBe('06 12 34 56 78');
  });

  it('autoComplete="tel" préservé', () => {
    render(<PhoneMaskInput id="phone" label="Téléphone" />);
    const input = screen.getByLabelText(/Téléphone/);
    expect(input.getAttribute('autocomplete')).toBe('tel');
  });

  it('inputMode="tel" préservé', () => {
    render(<PhoneMaskInput id="phone" label="Téléphone" />);
    const input = screen.getByLabelText(/Téléphone/);
    expect(input.getAttribute('inputmode')).toBe('tel');
  });
});
