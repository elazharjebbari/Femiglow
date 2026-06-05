/**
 * Vague 4 — FONDATION — wrappers fins de combobox (UX-COCKPIT-003, UX-CAMP-001,
 * UX-TPL-008, manques d'autocomplétion automation).
 *
 * Oracle UX4-FONDATION-008 : chaque wrapper interroge LA BONNE route et mappe la
 * réponse en options (value/label/hint). On s'appuie sur les handlers MSW par
 * défaut (`emailsHandlers`) des 3 nouvelles routes + templates/tags existantes.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { server, http, HttpResponse } from '@/test/msw/server';
import { emailsHandlers } from '@/test/msw/emails-handlers';
import {
  RecipientCombobox,
  SourceCombobox,
  LeadEmailCombobox,
  TemplateCombobox,
  TagCombobox,
} from '../combobox-wrappers';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function Controlled({
  Cmp,
  initial = '',
}: {
  Cmp: React.ComponentType<{
    value: string;
    onChange: (v: string) => void;
  }>;
  initial?: string;
}) {
  const [v, setV] = useState(initial);
  return (
    <>
      <Cmp value={v} onChange={setV} />
      <output data-testid="val">{v}</output>
    </>
  );
}

async function typeAndGetOptions(text: string): Promise<string[]> {
  const user = userEvent.setup();
  const input = screen.getByTestId('combobox-input');
  await user.type(input, text);
  const listbox = await screen.findByTestId('combobox-listbox');
  return within(listbox)
    .getAllByTestId('combobox-option')
    .map((li) => li.textContent ?? '');
}

describe('combobox-wrappers — UX4-FONDATION-008', () => {
  // resetHandlers (afterEach top-level) efface les handlers → ré-enregistrer
  // le nominal AVANT chaque test.
  beforeEach(() => server.use(...emailsHandlers));

  it('UX4-FONDATION-008 : RecipientCombobox interroge recipients-autocomplete', async () => {
    render(<Controlled Cmp={RecipientCombobox} />);
    const opts = await typeAndGetOptions('am');
    expect(opts.join('|')).toMatch(/amal@exemple\.test/);
    expect(opts.join('|')).toMatch(/amine@exemple\.test/);
    expect(opts.join('|')).not.toMatch(/bouchra/);
  });

  it('UX4-FONDATION-008b : SourceCombobox interroge la route sources', async () => {
    render(<Controlled Cmp={SourceCombobox} />);
    const opts = await typeAndGetOptions('api');
    expect(opts.join('|')).toMatch(/api\.contact/);
    expect(opts.join('|')).not.toMatch(/\bapp\b/);
  });

  it('UX4-FONDATION-008c : LeadEmailCombobox affiche email + nom (hint)', async () => {
    render(<Controlled Cmp={LeadEmailCombobox} />);
    const user = userEvent.setup();
    await user.type(screen.getByTestId('combobox-input'), 'amal');
    const listbox = await screen.findByTestId('combobox-listbox');
    const opt = within(listbox).getAllByTestId('combobox-option')[0]!;
    expect(opt).toHaveTextContent('amal@exemple.test');
    expect(opt).toHaveTextContent('Amal Benali'); // nom en hint
  });

  it('UX4-FONDATION-008d : TemplateCombobox filtre slug/nom et tague la source', async () => {
    render(<Controlled Cmp={TemplateCombobox} />);
    const opts = await typeAndGetOptions('welcome');
    expect(opts.join('|')).toMatch(/welcome-rituel/);
    expect(opts.join('|')).toMatch(/système|custom/);
  });

  it('UX4-FONDATION-008e : TagCombobox interroge tags/autocomplete avec compteur', async () => {
    // La route tags/autocomplete n'est pas dans emailsHandlers → handler local.
    server.use(
      http.get('/api/admin/leads/tags/autocomplete', () =>
        HttpResponse.json({ tags: [{ tag: 'vip', count: 12 }] }),
      ),
    );
    render(<Controlled Cmp={TagCombobox} />);
    const user = userEvent.setup();
    await user.type(screen.getByTestId('combobox-input'), 'vi');
    const listbox = await screen.findByTestId('combobox-listbox');
    const opt = within(listbox).getAllByTestId('combobox-option')[0]!;
    expect(opt).toHaveTextContent('vip');
    expect(opt).toHaveTextContent('12 contacts');
  });
});
