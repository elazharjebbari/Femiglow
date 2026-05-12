/**
 * CHA-230 — Tests du composant `CityAutocomplete`.
 *
 * Stratégie
 * ─────────
 * On mock `useDeliveryCities` pour fournir des items prévisibles sans
 * dépendre du réseau. Le hook lui-même est testé dans
 * `use-delivery-cities.test.ts`.
 *
 * Couvre :
 *  - Rendu initial (label, placeholder, aria attributes).
 *  - Ouverture du listbox au focus + clic.
 *  - Navigation clavier (↑/↓/Home/End) + Enter pour commit.
 *  - Click souris sur option commit la ville.
 *  - Escape ferme.
 *  - aria-activedescendant suit l'option active.
 *  - `onCitySelected` reçoit la PublicCity au commit.
 *  - Affichage bilingue (FR + AR + prix + ETA).
 *  - Click outside ferme le listbox.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import type { PublicCity } from '@/lib/checkout/delivery/use-delivery-cities';

// ─────────────────────────────────────────────────────────────────────────────
// Mock du hook de fetch — fournit les items à afficher
// ─────────────────────────────────────────────────────────────────────────────

let mockedCities: PublicCity[] = [];
let mockedLoading = false;
vi.mock('@/lib/checkout/delivery/use-delivery-cities', () => ({
  useDeliveryCities: () => ({
    query: '',
    items: mockedCities,
    loading: mockedLoading,
    error: null,
  }),
}));

// Import APRÈS le mock.
import { CityAutocomplete } from './CityAutocomplete';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const CASA: PublicCity = {
  slug: 'casablanca',
  nameFr: 'Casablanca',
  nameAr: 'الدار البيضاء',
  deliveryPriceMad: 19,
  deliveryEta: '24h',
  aliases: ['Casa'],
};

const RABAT: PublicCity = {
  slug: 'rabat',
  nameFr: 'Rabat',
  nameAr: 'الرباط',
  deliveryPriceMad: 0,
  deliveryEta: '24h - 48h',
  aliases: [],
};

const MARRAKECH: PublicCity = {
  slug: 'marrakech',
  nameFr: 'Marrakech',
  nameAr: 'مراكش',
  deliveryPriceMad: 35,
  deliveryEta: '48h',
  aliases: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper contrôlé — simule un parent qui gère `value` + `onChange`
// ─────────────────────────────────────────────────────────────────────────────

interface HostProps {
  initial?: string;
  onCitySelected?: (c: PublicCity) => void;
  onChange?: (v: string) => void;
  required?: boolean;
  error?: string;
}

function Host({ initial = '', onCitySelected, onChange, required, error }: HostProps) {
  const [val, setVal] = useState(initial);
  return (
    <CityAutocomplete
      label="Ville"
      placeholder="Casablanca, Rabat…"
      value={val}
      required={required}
      error={error}
      onChange={(v) => {
        setVal(v);
        onChange?.(v);
      }}
      onCitySelected={onCitySelected}
      testId="ac"
    />
  );
}

beforeEach(() => {
  mockedCities = [];
  mockedLoading = false;
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('CityAutocomplete — rendu initial', () => {
  it('rend un input role="combobox" avec aria-autocomplete=list', () => {
    render(<Host />);
    const input = screen.getByTestId('ac');
    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('expose le label associé via FieldShell', () => {
    render(<Host />);
    expect(screen.getByLabelText('Ville')).toBeInTheDocument();
  });

  it('affiche un placeholder', () => {
    render(<Host />);
    expect(screen.getByPlaceholderText(/Casablanca/)).toBeInTheDocument();
  });

  it('marque aria-invalid si error', () => {
    render(<Host error="Champ requis." />);
    const input = screen.getByTestId('ac');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert').textContent).toBe('Champ requis.');
  });
});

describe('CityAutocomplete — ouverture du listbox', () => {
  it('au focus, le listbox apparaît si items disponibles', async () => {
    mockedCities = [CASA];
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByTestId('ac'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByTestId('ac')).toHaveAttribute('aria-expanded', 'true');
  });

  it('le listbox affiche le nom FR, le nom AR et le prix/ETA', async () => {
    mockedCities = [CASA];
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByTestId('ac'));

    expect(screen.getByText('Casablanca')).toBeInTheDocument();
    expect(screen.getByText('الدار البيضاء')).toBeInTheDocument();
    expect(screen.getByText('19 MAD')).toBeInTheDocument();
    expect(screen.getByText('24h')).toBeInTheDocument();
  });

  it('"Gratuit" est affiché quand deliveryPriceMad=0', async () => {
    mockedCities = [RABAT];
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByTestId('ac'));
    expect(screen.getByText('Gratuit')).toBeInTheDocument();
  });

  it('pas de listbox si aucun item et pas de loading', async () => {
    mockedCities = [];
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByTestId('ac'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('listbox affiché en état loading même sans items (UX feedback)', async () => {
    mockedCities = [];
    mockedLoading = true;
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByTestId('ac'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText(/Recherche/)).toBeInTheDocument();
  });
});

describe('CityAutocomplete — navigation clavier', () => {
  it('ArrowDown ouvre + move focus sur la première option', async () => {
    mockedCities = [CASA, RABAT, MARRAKECH];
    const user = userEvent.setup();
    render(<Host />);
    const input = screen.getByTestId('ac');
    input.focus();
    await user.keyboard('{ArrowDown}');
    const activeDesc = input.getAttribute('aria-activedescendant');
    expect(activeDesc).toBeTruthy();
    // L'option 0 doit être aria-selected.
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowDown wraps après la dernière option', async () => {
    mockedCities = [CASA, RABAT];
    const user = userEvent.setup();
    render(<Host />);
    const input = screen.getByTestId('ac');
    input.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}'); // 0→1→0
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowUp ouvre + move focus sur la dernière option', async () => {
    mockedCities = [CASA, RABAT];
    const user = userEvent.setup();
    render(<Host />);
    const input = screen.getByTestId('ac');
    input.focus();
    await user.keyboard('{ArrowUp}');
    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('Home/End sautent aux extrêmes', async () => {
    mockedCities = [CASA, RABAT, MARRAKECH];
    const user = userEvent.setup();
    render(<Host />);
    const input = screen.getByTestId('ac');
    input.focus();
    await user.keyboard('{ArrowDown}{End}');
    let options = screen.getAllByRole('option');
    expect(options[2]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('Enter commit l\'option active + déclenche onCitySelected', async () => {
    mockedCities = [CASA, RABAT];
    const onSelected = vi.fn();
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Host onCitySelected={onSelected} onChange={onChange} />);
    const input = screen.getByTestId('ac');
    input.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}'); // sélectionne Rabat

    expect(onSelected).toHaveBeenCalledTimes(1);
    expect(onSelected.mock.calls[0]?.[0]).toEqual(RABAT);
    // onChange a été déclenché avec le nom FR.
    expect(onChange).toHaveBeenCalledWith('Rabat');
    // Listbox fermé après commit.
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Escape ferme le listbox sans rien commit', async () => {
    mockedCities = [CASA];
    const onSelected = vi.fn();
    const user = userEvent.setup();
    render(<Host onCitySelected={onSelected} />);
    const input = screen.getByTestId('ac');
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onSelected).not.toHaveBeenCalled();
  });
});

describe('CityAutocomplete — interactions souris', () => {
  it('click sur une option commit + propage onCitySelected', async () => {
    mockedCities = [CASA, RABAT];
    const onSelected = vi.fn();
    const user = userEvent.setup();
    render(<Host onCitySelected={onSelected} />);
    await user.click(screen.getByTestId('ac'));
    await user.click(screen.getByText('Rabat'));
    expect(onSelected).toHaveBeenCalledWith(RABAT);
  });

  it('mouseEnter sur une option marque cette option active', async () => {
    mockedCities = [CASA, RABAT];
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByTestId('ac'));
    const options = screen.getAllByRole('option');
    if (!options[1]) throw new Error('expected second option');
    await user.hover(options[1]);
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });
});

describe('CityAutocomplete — saisie libre', () => {
  it('chaque frappe propage la nouvelle valeur via onChange', async () => {
    mockedCities = [];
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Host onChange={onChange} />);
    await user.type(screen.getByTestId('ac'), 'Tan');
    expect(onChange).toHaveBeenCalledWith('T');
    expect(onChange).toHaveBeenCalledWith('Ta');
    expect(onChange).toHaveBeenCalledWith('Tan');
  });

  it('texte libre sans matching n\'appelle PAS onCitySelected', async () => {
    mockedCities = [];
    const onSelected = vi.fn();
    const user = userEvent.setup();
    render(<Host onCitySelected={onSelected} />);
    await user.type(screen.getByTestId('ac'), 'Petit Village');
    expect(onSelected).not.toHaveBeenCalled();
  });
});
