/**
 * UX4-AUDIENCES-003 (volet autocomplétion) — ClickUrlCombobox : la saisie
 * déclenche la route click-urls et propose les URLs tracées ; sur erreur 500,
 * aucune suggestion fantôme (le socle EntityCombobox expose l'état error).
 *
 * MSW lifecycle par fichier. Le combobox debounce (250ms) → on attend le fetch.
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
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { server, http, HttpResponse } from '@/test/msw/server';
import { ClickUrlCombobox } from './ClickUrlCombobox';

const URL = '/api/admin/emails/audiences/click-urls/autocomplete';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ClickUrlCombobox — UX4-AUDIENCES-003', () => {
  it('propose les URLs tracées renvoyées par la route', async () => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json({
          urls: [
            { url: 'https://femiglow-maroc.com/promo', count: 12 },
            { url: 'https://femiglow-maroc.com/kit', count: 4 },
          ],
        }),
      ),
    );
    render(<ClickUrlCombobox value="" onChange={vi.fn()} />);
    const input = screen.getByTestId('combobox-input');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'promo' } });
    });
    await waitFor(() => expect(screen.getByTestId('combobox-listbox')).toBeInTheDocument());
    expect(
      screen.getAllByTestId('combobox-option').some((o) => o.textContent?.includes('/promo')),
    ).toBe(true);
  });

  it('erreur 500 → état error (aucune suggestion fantôme)', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    render(<ClickUrlCombobox value="" onChange={vi.fn()} />);
    await act(async () => {
      fireEvent.change(screen.getByTestId('combobox-input'), { target: { value: 'x' } });
    });
    await waitFor(() => expect(screen.getByTestId('combobox-error')).toBeInTheDocument());
    expect(screen.queryByTestId('combobox-option')).not.toBeInTheDocument();
  });
});
