import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ValidatePairWizard } from './ValidatePairWizard';

const okResponse = {
  ok: true,
  bundleId: { config: 'a7c4f2e9b81d', mapping: 'a7c4f2e9b81d', match: true },
  errors: [],
  warnings: [],
  recommendations: [{ order: 1, action: 'Importer la config GTM en premier.' }],
};

const errorResponse = {
  ok: false,
  bundleId: { config: 'aaaa', mapping: 'bbbb', match: false },
  errors: [
    {
      code: 'bundle_mismatch',
      severity: 'error' as const,
      message: 'Bundle ID incohérent.',
      fix: 'Re-générer les 2 fichiers.',
    },
  ],
  warnings: [],
  recommendations: [{ order: 1, action: 'Corriger.' }],
};

function fileFromJson(name: string, payload: unknown): File {
  return new File([JSON.stringify(payload)], name, { type: 'application/json' });
}

describe('ValidatePairWizard', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => okResponse,
    } as Response);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('démarre à l\'étape 1, bouton Suivant désactivé sans fichier', () => {
    render(<ValidatePairWizard />);
    expect(screen.getByTestId('validate-pair-wizard')).toBeInTheDocument();
    expect(screen.getByText(/Étape 1 \/ 3 — Configuration GTM/)).toBeInTheDocument();
    expect(screen.getByTestId('btn-next-step')).toBeDisabled();
  });

  it('active le bouton après upload du config', async () => {
    const user = userEvent.setup();
    render(<ValidatePairWizard />);
    const input = screen.getByTestId('config-dropzone') as HTMLInputElement;
    await user.upload(input, fileFromJson('config-v4.json', { containerVersion: {} }));
    await waitFor(() => expect(screen.getByTestId('btn-next-step')).toBeEnabled());
  });

  it('avance à l\'étape 2 et confirme le fichier chargé', async () => {
    const user = userEvent.setup();
    render(<ValidatePairWizard />);
    const input = screen.getByTestId('config-dropzone') as HTMLInputElement;
    await user.upload(input, fileFromJson('config-v4.json', { containerVersion: {} }));
    await waitFor(() => expect(screen.getByTestId('btn-next-step')).toBeEnabled());
    await user.click(screen.getByTestId('btn-next-step'));
    expect(screen.getByText(/Étape 2 \/ 3 — Mapping vendors/)).toBeInTheDocument();
    expect(screen.getByText(/config-v4.json/)).toBeInTheDocument();
  });

  it('soumet et affiche le verdict OK à l\'étape 3', async () => {
    const user = userEvent.setup();
    render(<ValidatePairWizard />);
    await user.upload(
      screen.getByTestId('config-dropzone'),
      fileFromJson('config-v4.json', { containerVersion: {} }),
    );
    await waitFor(() => expect(screen.getByTestId('btn-next-step')).toBeEnabled());
    await user.click(screen.getByTestId('btn-next-step'));
    await user.upload(
      screen.getByTestId('mapping-dropzone'),
      fileFromJson('mapping-v17.json', { manifest: {}, mappings: {} }),
    );
    await waitFor(() => expect(screen.getByTestId('btn-validate')).toBeEnabled());
    await user.click(screen.getByTestId('btn-validate'));
    await waitFor(() => {
      expect(screen.getByTestId('verdict')).toBeInTheDocument();
    });
    expect(screen.getByTestId('verdict')).toHaveAttribute('data-ok', 'true');
  });

  it('affiche les erreurs si verdict KO', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => errorResponse,
    } as Response);
    const user = userEvent.setup();
    render(<ValidatePairWizard />);
    await user.upload(
      screen.getByTestId('config-dropzone'),
      fileFromJson('c.json', {}),
    );
    await waitFor(() => expect(screen.getByTestId('btn-next-step')).toBeEnabled());
    await user.click(screen.getByTestId('btn-next-step'));
    await user.upload(
      screen.getByTestId('mapping-dropzone'),
      fileFromJson('m.json', {}),
    );
    await waitFor(() => expect(screen.getByTestId('btn-validate')).toBeEnabled());
    await user.click(screen.getByTestId('btn-validate'));
    await waitFor(() => {
      expect(screen.getByTestId('verdict')).toHaveAttribute('data-ok', 'false');
    });
    expect(screen.getByText(/Bundle ID incohérent/)).toBeInTheDocument();
  });

  it('gère un JSON invalide en step 1 (message d\'erreur)', async () => {
    const user = userEvent.setup();
    render(<ValidatePairWizard />);
    const badFile = new File(['not json {{{'], 'bad.json', { type: 'application/json' });
    await user.upload(screen.getByTestId('config-dropzone'), badFile);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/n'est pas un JSON valide/);
    expect(screen.getByTestId('btn-next-step')).toBeDisabled();
  });

  it('gère une erreur réseau gracieusement', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network fail'));
    const user = userEvent.setup();
    render(<ValidatePairWizard />);
    await user.upload(
      screen.getByTestId('config-dropzone'),
      fileFromJson('c.json', {}),
    );
    await waitFor(() => expect(screen.getByTestId('btn-next-step')).toBeEnabled());
    await user.click(screen.getByTestId('btn-next-step'));
    await user.upload(
      screen.getByTestId('mapping-dropzone'),
      fileFromJson('m.json', {}),
    );
    await waitFor(() => expect(screen.getByTestId('btn-validate')).toBeEnabled());
    await user.click(screen.getByTestId('btn-validate'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Network fail/);
    });
  });

  it('permet de recommencer après un verdict', async () => {
    const user = userEvent.setup();
    render(<ValidatePairWizard />);
    await user.upload(
      screen.getByTestId('config-dropzone'),
      fileFromJson('c.json', {}),
    );
    await waitFor(() => expect(screen.getByTestId('btn-next-step')).toBeEnabled());
    await user.click(screen.getByTestId('btn-next-step'));
    await user.upload(
      screen.getByTestId('mapping-dropzone'),
      fileFromJson('m.json', {}),
    );
    await waitFor(() => expect(screen.getByTestId('btn-validate')).toBeEnabled());
    await user.click(screen.getByTestId('btn-validate'));
    await waitFor(() => expect(screen.getByTestId('verdict')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Recommencer/i }));
    expect(screen.getByText(/Étape 1 \/ 3/)).toBeInTheDocument();
  });

  it('le bouton Retour ramène à l\'étape 1 sans perdre le fichier', async () => {
    const user = userEvent.setup();
    render(<ValidatePairWizard />);
    await user.upload(
      screen.getByTestId('config-dropzone'),
      fileFromJson('c.json', {}),
    );
    await waitFor(() => expect(screen.getByTestId('btn-next-step')).toBeEnabled());
    await user.click(screen.getByTestId('btn-next-step'));
    await user.click(screen.getByRole('button', { name: /^← Retour$/ }));
    expect(screen.getByText(/Étape 1 \/ 3/)).toBeInTheDocument();
    expect(screen.getByTestId('btn-next-step')).toBeEnabled();
  });

  it('stepper indique l\'étape courante', async () => {
    const user = userEvent.setup();
    render(<ValidatePairWizard />);
    const step1Li = screen.getByText('Config GTM').closest('li')!;
    expect(step1Li.className).toMatch(/font-medium/);
    await user.upload(
      screen.getByTestId('config-dropzone'),
      fileFromJson('c.json', {}),
    );
    await waitFor(() => expect(screen.getByTestId('btn-next-step')).toBeEnabled());
    await user.click(screen.getByTestId('btn-next-step'));
    const step2Li = screen.getByText('Mapping').closest('li')!;
    expect(step2Li.className).toMatch(/font-medium/);
  });
});
