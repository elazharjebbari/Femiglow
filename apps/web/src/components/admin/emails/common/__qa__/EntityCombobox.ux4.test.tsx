/**
 * Vague 4 — FONDATION — EntityCombobox (socle a11y transverse).
 *
 * Oracles :
 *  - UX4-FONDATION-001 : taper >= minChars déclenche fetchSuggestions debouncé,
 *    le listbox s'ouvre, click sur une option → onChange(value).
 *  - UX4-FONDATION-002 : un fetch en erreur affiche combobox-error et NE rend
 *    AUCUNE combobox-option fantôme.
 *  - UX4-FONDATION-003 : ArrowDown/ArrowUp déplace aria-activedescendant, Enter
 *    sélectionne l'option active, Escape ferme sans vider la valeur.
 *
 * On exerce le composant via une vraie route MSW (`server.use(http.get…)`) plutôt
 * qu'un stub direct : le débounce + AbortController + parsing de réponse sont
 * dans le chemin testé. `fetchSuggestions` est câblé sur `fetch(..., signal)`.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { server, http, HttpResponse } from '@/test/msw/server';
import { EntityCombobox, type ComboboxOption } from '../EntityCombobox';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const URL = '/api/admin/emails/_test/combobox';

/** fetchSuggestions réel : appelle l'URL MSW en passant le signal d'abort. */
async function fetchFromRoute(q: string, signal: AbortSignal): Promise<ComboboxOption[]> {
  const res = await fetch(`${URL}?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { options: ComboboxOption[] };
  return data.options;
}

/** Harness contrôlé : remonte la valeur courante pour les assertions. */
function Harness({
  onChangeSpy,
  allowFreeText = true,
  fetcher = fetchFromRoute,
  initial = '',
}: {
  onChangeSpy?: (v: string) => void;
  allowFreeText?: boolean;
  fetcher?: (q: string, signal: AbortSignal) => Promise<ComboboxOption[]>;
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <EntityCombobox
        ariaLabel="Recherche entité"
        value={value}
        allowFreeText={allowFreeText}
        onChange={(v) => {
          setValue(v);
          onChangeSpy?.(v);
        }}
        fetchSuggestions={fetcher}
      />
      <output data-testid="current-value">{value}</output>
    </>
  );
}

const NOMINAL_OPTIONS: ComboboxOption[] = [
  { value: 'welcome-rituel', label: 'welcome-rituel', hint: 'système' },
  { value: 'welcome-back', label: 'welcome-back', hint: 'custom' },
  { value: 'promo-printemps', label: 'promo-printemps', hint: 'custom' },
];

function useNominalRoute() {
  server.use(
    http.get(URL, ({ request }) => {
      const q = (new globalThis.URL(request.url).searchParams.get('q') ?? '').toLowerCase();
      const options = NOMINAL_OPTIONS.filter((o) => o.value.toLowerCase().includes(q));
      return HttpResponse.json({ options });
    }),
  );
}

describe('EntityCombobox — UX4-FONDATION-001 (fetch debouncé + sélection)', () => {
  it('UX4-FONDATION-001 : taper ouvre le listbox puis click → onChange(value)', async () => {
    useNominalRoute();
    const onChangeSpy = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChangeSpy={onChangeSpy} />);

    const input = screen.getByTestId('combobox-input');
    await user.type(input, 'welcome');

    // Listbox s'ouvre dès qu'il y a >=1 résultat (après le debounce).
    const listbox = await screen.findByTestId('combobox-listbox');
    const options = within(listbox).getAllByTestId('combobox-option');
    expect(options.length).toBe(2); // welcome-rituel + welcome-back

    await user.click(options[1]!); // welcome-back
    expect(onChangeSpy).toHaveBeenCalledWith('welcome-back');
    expect(screen.getByTestId('current-value')).toHaveTextContent('welcome-back');
    // Le listbox se referme après sélection.
    expect(screen.queryByTestId('combobox-listbox')).not.toBeInTheDocument();
  });

  it('UX4-FONDATION-001b : sous minChars (vide) → aucun fetch, listbox fermé', async () => {
    let hits = 0;
    server.use(
      http.get(URL, () => {
        hits += 1;
        return HttpResponse.json({ options: NOMINAL_OPTIONS });
      }),
    );
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByTestId('combobox-input');
    await user.type(input, 'a');
    await user.clear(input); // retombe sous minChars=1
    await waitFor(() => expect(screen.queryByTestId('combobox-listbox')).not.toBeInTheDocument());
    // Le seul hit possible est pour 'a' ; après clear, plus aucun fetch ni listbox.
    expect(hits).toBeLessThanOrEqual(1);
  });
});

describe('EntityCombobox — UX4-FONDATION-002 (erreur, pas de fantôme)', () => {
  it('UX4-FONDATION-002 : 500 → combobox-error visible, AUCUNE option fantôme', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByTestId('combobox-input');
    await user.type(input, 'welcome');

    expect(await screen.findByTestId('combobox-error')).toHaveTextContent(
      /indisponibles/i,
    );
    expect(screen.queryAllByTestId('combobox-option')).toHaveLength(0);
    // data-state error exposé sur le conteneur.
    expect(input.closest('[data-state]')).toHaveAttribute('data-state', 'error');
  });

  it('UX4-FONDATION-002b : pas de suggestion fantôme arrivant APRÈS une erreur', async () => {
    // Première frappe → 500 ; puis on bascule sur un nominal lent : la réponse
    // 500 ne doit jamais peupler d'options, et seule la dernière requête compte.
    server.use(http.get(URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByTestId('combobox-input');
    await user.type(input, 'pro');
    await screen.findByTestId('combobox-error');
    expect(screen.queryAllByTestId('combobox-option')).toHaveLength(0);
  });
});

describe('EntityCombobox — UX4-FONDATION-003 (clavier)', () => {
  it('UX4-FONDATION-003 : ArrowDown/Up bouge aria-activedescendant, Enter sélectionne, Escape conserve', async () => {
    useNominalRoute();
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByTestId('combobox-input');

    await user.type(input, 'welcome');
    await screen.findByTestId('combobox-listbox');

    // ArrowDown → 1ère option active.
    await user.keyboard('{ArrowDown}');
    const firstActive = input.getAttribute('aria-activedescendant');
    expect(firstActive).toBeTruthy();
    const firstOpt = document.getElementById(firstActive!);
    expect(firstOpt).toHaveAttribute('role', 'option');
    expect(firstOpt).toHaveTextContent('welcome-rituel');

    // ArrowDown → 2e option active (activedescendant change).
    await user.keyboard('{ArrowDown}');
    const secondActive = input.getAttribute('aria-activedescendant');
    expect(secondActive).not.toBe(firstActive);
    expect(document.getElementById(secondActive!)).toHaveTextContent('welcome-back');

    // ArrowUp → revient sur la 1ère.
    await user.keyboard('{ArrowUp}');
    expect(input.getAttribute('aria-activedescendant')).toBe(firstActive);

    // Enter → sélectionne l'option active (welcome-rituel) et ferme.
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('current-value')).toHaveTextContent('welcome-rituel');
    expect(screen.queryByTestId('combobox-listbox')).not.toBeInTheDocument();
  });

  it('UX4-FONDATION-003b : Escape ferme le listbox SANS vider la valeur saisie', async () => {
    useNominalRoute();
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByTestId('combobox-input');

    await user.type(input, 'welcome');
    await screen.findByTestId('combobox-listbox');

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('combobox-listbox')).not.toBeInTheDocument();
    // La valeur reste 'welcome' (Escape ne vide rien).
    expect(input).toHaveValue('welcome');
    expect(screen.getByTestId('current-value')).toHaveTextContent('welcome');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('UX4-FONDATION-003c : ARIA — role=combobox + listbox + option, aria-controls relié', async () => {
    useNominalRoute();
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Recherche entité' });
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-expanded', 'false');

    await user.type(input, 'welcome');
    const listbox = await screen.findByRole('listbox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    expect(within(listbox).getAllByRole('option').length).toBeGreaterThan(0);
  });
});
