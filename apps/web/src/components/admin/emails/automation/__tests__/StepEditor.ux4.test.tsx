/**
 * UX-AUT-004/005 / UX4-AUTOMATIONS-003 — StepEditor : Template & Tag en combobox.
 *
 * Le défaut corrigé : Template slug et Tag étaient des <input type=text> libres
 * → un slug inexistant passait sans validation ni suggestion (run errored
 * silencieux à l'exécution). On branche désormais les wrappers du socle commun
 * (TemplateCombobox / TagCombobox) sur les routes /autocomplete.
 *
 * Oracle : le champ Template est un combobox (role=combobox) alimenté par
 * /api/admin/emails/templates/autocomplete ; le champ Tag par
 * /api/admin/leads/tags/autocomplete. Sélectionner une suggestion met à jour
 * la valeur du step.
 */
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { StepEditor } from '../StepEditor';
import type { AutomationStep } from '@/lib/mail/automation/step-types-v2';

const TPL_URL = '/api/admin/emails/templates/autocomplete';
const TAG_URL = '/api/admin/leads/tags/autocomplete';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('StepEditor — Template & Tag en combobox (UX4-AUTOMATIONS-003)', () => {
  it('UX4-AUTOMATIONS-003a : le champ Template est un combobox alimenté par /templates/autocomplete', async () => {
    server.use(
      http.get(TPL_URL, () =>
        HttpResponse.json({
          templates: [
            { slug: 'welcome-1', name: 'Bienvenue', source: 'system' },
            { slug: 'welcome-rituel', name: 'Rituel', source: 'custom' },
          ],
        }),
      ),
    );
    const onChange = vi.fn();
    const value: AutomationStep = { kind: 'send', template: '', payloadKeys: [] };
    const user = userEvent.setup();
    render(<StepEditor value={value} onChange={onChange} />);

    const input = screen.getByRole('combobox', { name: /template/i });
    await user.type(input, 'welcome');

    // La listbox s'ouvre avec les suggestions de la route.
    const listbox = await screen.findByTestId('combobox-listbox');
    const option = within(listbox).getByText('welcome-rituel');
    await user.click(option);

    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'send',
      template: 'welcome-rituel',
      payloadKeys: [],
    });
  });

  it('UX4-AUTOMATIONS-003b : le champ Tag est un combobox alimenté par /leads/tags/autocomplete', async () => {
    server.use(
      http.get(TAG_URL, () =>
        HttpResponse.json({
          tags: [
            { tag: 'vip', count: 12 },
            { tag: 'vip-plus', count: 3 },
          ],
        }),
      ),
    );
    const onChange = vi.fn();
    const value: AutomationStep = { kind: 'tag', action: 'add', tag: '' };
    const user = userEvent.setup();
    render(<StepEditor value={value} onChange={onChange} />);

    const input = screen.getByRole('combobox', { name: /tag/i });
    await user.type(input, 'vip');

    const listbox = await screen.findByTestId('combobox-listbox');
    const option = within(listbox).getByText('vip-plus');
    await user.click(option);

    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'tag',
      action: 'add',
      tag: 'vip-plus',
    });
  });
});
