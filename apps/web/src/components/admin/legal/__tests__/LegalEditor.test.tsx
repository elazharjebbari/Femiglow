import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { server } from '@/test/msw/server';
import { defaultLegalState, legalHandlers, legalScenarios } from '@/test/msw/legal-handlers';
import { LegalEditor } from '../LegalEditor';

const baseProps = {
  slug: 'cgv',
  initialTitle: 'CGV',
  initialDescription: 'desc',
  initialBodyMd: '# CGV\n\n**Société {{COMPANY_NAME}}** RC : {{COMPANY_RC}}',
  initialIncludeInSearch: false,
  status: 'draft' as const,
  version: 3,
  initialUpdatedAtMs: 1715600000000,
  templateVars: [
    { key: 'COMPANY_NAME', value: 'FemiGlow', isRequired: true },
    { key: 'COMPANY_RC', value: '', isRequired: true },
  ],
  placements: [
    { zoneKey: 'footer-main', isVisible: true, displayOrder: 1, labelOverride: null },
  ],
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  const state = JSON.parse(JSON.stringify(defaultLegalState)) as typeof defaultLegalState;
  state.pages.cgv = { slug: 'cgv', version: baseProps.version, status: 'draft' };
  state.vars = { COMPANY_NAME: 'FemiGlow', COMPANY_RC: '' };
  server.use(...legalHandlers(state));
});

describe('LegalEditor — affichage', () => {
  it('rend titre, description, body, version', () => {
    render(<LegalEditor {...baseProps} />);
    expect(screen.getByDisplayValue('CGV')).toBeInTheDocument();
    expect(screen.getByDisplayValue('desc')).toBeInTheDocument();
    expect(screen.getByText(/Brouillon · v3/)).toBeInTheDocument();
  });

  it('preview affiche le HTML avec substitution', () => {
    render(<LegalEditor {...baseProps} />);
    // preview contient FemiGlow (substitué), COMPANY_RC reste [COMPANY_RC] (fallback)
    const previewBlocks = screen.getAllByText((_, el) =>
      Boolean(el && el.textContent?.includes('FemiGlow')),
    );
    expect(previewBlocks.length).toBeGreaterThan(0);
  });

  it('liste les placements en details', () => {
    render(<LegalEditor {...baseProps} />);
    expect(screen.getByText(/Placements/)).toBeInTheDocument();
    expect(screen.getByText(/footer-main/)).toBeInTheDocument();
  });
});

describe('LegalEditor — édition + sauvegarde', () => {
  it('le bouton "Enregistrer" est désactivé quand pas dirty', () => {
    render(<LegalEditor {...baseProps} />);
    expect(screen.getByRole('button', { name: /Enregistrer/ })).toBeDisabled();
  });

  it('édite le titre puis save → POST PATCH + version bumped', async () => {
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    const titleInput = screen.getByDisplayValue('CGV') as HTMLInputElement;

    await user.clear(titleInput);
    await user.type(titleInput, 'CGV 2026');

    const saveBtn = screen.getByRole('button', { name: /Enregistrer/ });
    expect(saveBtn).toBeEnabled();
    await user.click(saveBtn);

    await waitFor(() => expect(screen.getByText('✓ Enregistré')).toBeInTheDocument());
    // Version a été bumpée (3 → 4)
    await waitFor(() => expect(screen.getByText(/v4/)).toBeInTheDocument());
  });

  it('échec serveur → affiche "Erreur de sauvegarde"', async () => {
    server.use(legalScenarios.patchFails('cgv'));
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    const titleInput = screen.getByDisplayValue('CGV') as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, 'new');
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));
    await waitFor(() =>
      expect(screen.getByText(/Erreur de sauvegarde/)).toBeInTheDocument(),
    );
  });

  it('409 version_conflict → ouvre modal "Conflit de version"', async () => {
    server.use(legalScenarios.patchConflict('cgv'));
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    const titleInput = screen.getByDisplayValue('CGV') as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, 'collision');
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));

    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: /Conflit de version/i })).toBeInTheDocument(),
    );
    // Le bouton "Recharger" est présent
    expect(screen.getByRole('button', { name: /Recharger/ })).toBeInTheDocument();
  });

  it('envoie If-Match header avec l\'ETag courant', async () => {
    let receivedIfMatch: string | null = null;
    server.use(
      // override le handler pour capturer le header
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (await import('msw')).http.patch('/api/admin/legal/cgv', async ({ request }) => {
        receivedIfMatch = request.headers.get('If-Match');
        return (await import('msw')).HttpResponse.json({
          id: 'lp_x',
          slug: 'cgv',
          title: 'CGV',
          description: 'desc',
          body_md: 'x',
          status: 'draft',
          version: 3,
          updated_at: new Date().toISOString(),
        });
      }),
    );
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    const titleInput = screen.getByDisplayValue('CGV') as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, 'new');
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));

    await waitFor(() => expect(receivedIfMatch).toBe(`W/"${baseProps.initialUpdatedAtMs}"`));
  });
});

describe('LegalEditor — publish modal', () => {
  it('ouvre la modal et bloque publish si confirm != PUBLIER', async () => {
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);

    await user.click(screen.getByRole('button', { name: /Publier$/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const confirmInput = screen.getByLabelText(/PUBLIER pour confirmer/);
    await user.type(confirmInput, 'publier');

    const publishBtn = screen.getByRole('button', { name: /Publier maintenant/ });
    expect(publishBtn).toBeDisabled();
  });

  it('publie avec succès si confirm=PUBLIER et tous les vars remplis', async () => {
    const user = userEvent.setup();
    const propsAllFilled = {
      ...baseProps,
      templateVars: [
        { key: 'COMPANY_NAME', value: 'FemiGlow', isRequired: true },
        { key: 'COMPANY_RC', value: '12345', isRequired: true },
      ],
    };
    // Update MSW state to reflect filled vars
    const state = JSON.parse(JSON.stringify(defaultLegalState)) as typeof defaultLegalState;
    state.pages.cgv = { slug: 'cgv', version: 3, status: 'draft' };
    state.vars = { COMPANY_NAME: 'FemiGlow', COMPANY_RC: '12345' };
    server.use(...legalHandlers(state));

    render(<LegalEditor {...propsAllFilled} />);
    await user.click(screen.getByRole('button', { name: /Publier$/ }));
    await user.type(screen.getByLabelText(/PUBLIER pour confirmer/), 'PUBLIER');
    await user.click(screen.getByRole('button', { name: /Publier maintenant/ }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/Publié · v4/)).toBeInTheDocument());
  });

  it('affiche les variables manquantes si publish renvoie 422', async () => {
    server.use(legalScenarios.publishMissingVars(['COMPANY_RC', 'ICE']));
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);

    await user.click(screen.getByRole('button', { name: /Publier$/ }));
    await user.type(screen.getByLabelText(/PUBLIER pour confirmer/), 'PUBLIER');
    await user.click(screen.getByRole('button', { name: /Publier maintenant/ }));

    await waitFor(() =>
      expect(screen.getByText(/Variables manquantes/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/COMPANY_RC, ICE/)).toBeInTheDocument();
  });

  it('affiche un warning de variables manquantes dans la modal au moment de l\'ouverture', async () => {
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />); // COMPANY_RC vide

    await user.click(screen.getByRole('button', { name: /Publier$/ }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/1 variable\(s\) manquante\(s\)/);
    expect(dialog).toHaveTextContent(/COMPANY_RC/);
  });

  it('annule la modal sans publier', async () => {
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /Publier$/ }));
    await user.click(screen.getByRole('button', { name: /Annuler/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
