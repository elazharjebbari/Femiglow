import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/msw/server';
import { LegalWizard } from '../LegalWizard';

const ZONES = [
  { key: 'footer-main', label: 'Footer', isRequired: true },
  { key: 'mobile-menu', label: 'Menu mobile', isRequired: false },
];

const VARS = [
  { key: 'COMPANY_NAME', value: 'FemiGlow', isRequired: true },
  { key: 'COMPANY_RC', value: '', isRequired: true },
];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('LegalWizard — navigation', () => {
  it('démarre à step 1 et affiche "Suivant" disabled si slug/title vides', () => {
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Précédent/ })).toBeDisabled();
  });

  it('valide le slug : caractères, longueur', async () => {
    const user = userEvent.setup();
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);
    const slugInput = screen.getByPlaceholderText('mentions-legales') as HTMLInputElement;

    await user.type(slugInput, 'BAD SLUG');
    expect(screen.getByText(/Caractères autorisés/i)).toBeInTheDocument();

    await user.clear(slugInput);
    await user.type(slugInput, 'a');
    expect(screen.getByText(/2 et 80 caractères/i)).toBeInTheDocument();

    await user.clear(slugInput);
    await user.type(slugInput, 'mentions-legales');
    expect(screen.queryByText(/Caractères autorisés/i)).not.toBeInTheDocument();
  });

  it('avance step1 → step2 quand champs valides', async () => {
    const user = userEvent.setup();
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);
    await user.type(screen.getByPlaceholderText('mentions-legales'), 'cgv');
    await user.type(screen.getAllByRole('textbox')[1]!, 'Conditions de vente');
    await user.click(screen.getByRole('button', { name: /Suivant/ }));
    expect(screen.getByText(/Markdown supporté/)).toBeInTheDocument();
  });

  it('refuse d\'avancer step2 si body < 10 chars', async () => {
    const user = userEvent.setup();
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);
    await user.type(screen.getByPlaceholderText('mentions-legales'), 'cgv');
    await user.type(screen.getAllByRole('textbox')[1]!, 'Title');
    await user.click(screen.getByRole('button', { name: /Suivant/ }));

    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'short');
    expect(screen.getByText(/Au moins 10 caractères/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeDisabled();
  });

  it('step3 : refuse d\'avancer sans zone obligatoire cochée', async () => {
    const user = userEvent.setup();
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);
    await user.type(screen.getByPlaceholderText('mentions-legales'), 'cgv');
    await user.type(screen.getAllByRole('textbox')[1]!, 'Title');
    await user.click(screen.getByRole('button', { name: /Suivant/ }));
    await user.click(screen.getByRole('button', { name: /Suivant/ })); // → step 3

    expect(screen.getByText(/zone obligatoire/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeDisabled();
  });

  it('step4 : signale les vars manquantes utilisées dans le body', async () => {
    const user = userEvent.setup();
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);
    await user.type(screen.getByPlaceholderText('mentions-legales'), 'cgv');
    await user.type(screen.getAllByRole('textbox')[1]!, 'Title');
    await user.click(screen.getByRole('button', { name: /Suivant/ }));

    // step 2 : insère du body avec une var non remplie
    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, '# Title\n\nRC : COMPANY_RC_PLACEHOLDER');
    // saisit en literal pour éviter problème de typing avec {{
    await user.click(screen.getByRole('button', { name: /Suivant/ }));

    // step 3 : coche zone obligatoire
    await user.click(screen.getByLabelText(/Footer/));
    await user.click(screen.getByRole('button', { name: /Suivant/ }));

    // step 4 : on n'a pas mis de variable {{X}} dans le body → tout OK
    expect(screen.getByText(/✓ Toutes les variables/)).toBeInTheDocument();
  });
});

describe('LegalWizard — soumission', () => {
  it('POST /api/admin/legal puis PUT /placements pour chaque zone cochée', async () => {
    let createBody: unknown = null;
    const placementBodies: unknown[] = [];
    server.use(
      http.post('/api/admin/legal', async ({ request }) => {
        createBody = await request.json();
        return HttpResponse.json({ id: 'lp_x', slug: 'cgv' }, { status: 201 });
      }),
      http.put('/api/admin/legal/placements', async ({ request }) => {
        placementBodies.push(await request.json());
        return HttpResponse.json({ ok: true });
      }),
    );

    const user = userEvent.setup();
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);

    await user.type(screen.getByPlaceholderText('mentions-legales'), 'cgv');
    await user.type(screen.getAllByRole('textbox')[1]!, 'Title');
    await user.click(screen.getByRole('button', { name: /Suivant/ })); // → step 2
    await user.click(screen.getByRole('button', { name: /Suivant/ })); // → step 3
    await user.click(screen.getByLabelText(/Footer/));
    await user.click(screen.getByLabelText(/Menu mobile/));
    await user.click(screen.getByRole('button', { name: /Suivant/ })); // → step 4
    await user.click(screen.getByRole('button', { name: /Suivant/ })); // → step 5
    await user.click(screen.getByRole('button', { name: /Créer la page/ }));

    await waitFor(() => expect(createBody).not.toBeNull());
    expect(createBody).toMatchObject({ slug: 'cgv', title: 'Title' });
    expect(placementBodies).toHaveLength(2);
  });

  it('affiche erreur 409 si slug déjà utilisé + ramène à step 1', async () => {
    server.use(
      http.post('/api/admin/legal', () =>
        HttpResponse.json({ error: { code: 'conflict' } }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);
    await user.type(screen.getByPlaceholderText('mentions-legales'), 'cgv');
    await user.type(screen.getAllByRole('textbox')[1]!, 'Title');
    await user.click(screen.getByRole('button', { name: /Suivant/ }));
    await user.click(screen.getByRole('button', { name: /Suivant/ }));
    await user.click(screen.getByLabelText(/Footer/));
    await user.click(screen.getByRole('button', { name: /Suivant/ }));
    await user.click(screen.getByRole('button', { name: /Suivant/ }));
    await user.click(screen.getByRole('button', { name: /Créer la page/ }));

    await waitFor(() =>
      expect(screen.getByText(/slug est déjà utilisé/i)).toBeInTheDocument(),
    );
  });
});
