import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { server } from '@/test/msw/server';
import { defaultLegalState, legalHandlers, legalScenarios } from '@/test/msw/legal-handlers';
import { TemplateVarsEditor } from '../TemplateVarsEditor';

const VARS = [
  {
    key: 'COMPANY_NAME',
    label: 'Nom légal',
    description: 'Dénomination',
    value: 'FemiGlow',
    isRequired: true,
    sensitive: false,
  },
  {
    key: 'COMPANY_RC',
    label: 'Registre Commerce',
    description: null,
    value: '',
    isRequired: true,
    sensitive: false,
  },
  {
    key: 'API_KEY',
    label: 'Clé API',
    description: null,
    value: 'sk-supersecret',
    isRequired: false,
    sensitive: true,
  },
];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  const state = JSON.parse(JSON.stringify(defaultLegalState)) as typeof defaultLegalState;
  state.vars = { COMPANY_NAME: 'FemiGlow', COMPANY_RC: '', API_KEY: 'sk-supersecret' };
  server.use(...legalHandlers(state));
});

describe('TemplateVarsEditor — rendu', () => {
  it('affiche toutes les variables avec leurs valeurs', () => {
    render(<TemplateVarsEditor vars={VARS} />);
    expect(screen.getByText('COMPANY_NAME')).toBeInTheDocument();
    expect(screen.getByText('COMPANY_RC')).toBeInTheDocument();
    expect(screen.getByText('API_KEY')).toBeInTheDocument();
  });

  it('marque les variables required vides en rouge', () => {
    render(<TemplateVarsEditor vars={VARS} />);
    // Le seul input "required vide" est COMPANY_RC (COMPANY_NAME est rempli)
    const rcRow = screen.getByText('COMPANY_RC').closest('tr')!;
    const rcInput = rcRow.querySelector('input')!;
    expect(rcInput).toHaveClass('border-red-300');
  });

  it('affiche les sensitive en type=password', () => {
    render(<TemplateVarsEditor vars={VARS} />);
    const apiInput = screen.getByDisplayValue('sk-supersecret');
    expect(apiInput).toHaveAttribute('type', 'password');
  });

  it('le bouton Save est disabled tant que la valeur n\'a pas changé', () => {
    render(<TemplateVarsEditor vars={VARS} />);
    const saveBtns = screen.getAllByRole('button', { name: /Save/ });
    saveBtns.forEach((b) => expect(b).toBeDisabled());
  });
});

describe('TemplateVarsEditor — édition', () => {
  it('saisir une valeur active Save → PUT API → MAJ locale', async () => {
    const user = userEvent.setup();
    render(<TemplateVarsEditor vars={VARS} />);

    const rcRow = screen.getByText('COMPANY_RC').closest('tr')!;
    const rcInput = rcRow.querySelector('input') as HTMLInputElement;
    await user.type(rcInput, '12345/Rabat');

    // Le Save sur cette ligne devient enabled. On clique le save de la ligne RC.
    const row = rcInput.closest('tr')!;
    const saveBtn = row.querySelector('button')!;
    expect(saveBtn).not.toBeDisabled();
    await user.click(saveBtn);

    await waitFor(() => expect(saveBtn).toBeDisabled());
    // Après save : la nouvelle valeur est l'état "courant", donc save redevient
    // disabled (pas de diff).
  });

  it('affiche une bannière d\'erreur si PUT échoue', async () => {
    server.use(legalScenarios.varUpdateInvalid());
    const user = userEvent.setup();
    render(<TemplateVarsEditor vars={VARS} />);

    const rcRow = screen.getByText('COMPANY_RC').closest('tr')!;
    const rcInput = rcRow.querySelector('input')!;
    await user.type(rcInput, 'x');
    await user.click(rcRow.querySelector('button')!);

    await waitFor(() => expect(screen.getByText(/HTTP 422/)).toBeInTheDocument());
  });
});
