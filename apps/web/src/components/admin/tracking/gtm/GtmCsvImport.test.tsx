import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GtmCsvImport } from './GtmCsvImport';

describe('GtmCsvImport', () => {
  it('affiche le bouton "Importer un CSV"', () => {
    render(<GtmCsvImport onApply={() => {}} />);
    expect(screen.getByRole('button', { name: /importer un csv/i })).toBeInTheDocument();
  });

  it('ouvre la modale au clic + textarea visible', async () => {
    const user = userEvent.setup();
    render(<GtmCsvImport onApply={() => {}} />);
    await user.click(screen.getByRole('button', { name: /importer un csv/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/csv à importer/i)).toBeInTheDocument();
  });

  it('génère un aperçu quand on tape du CSV valide', async () => {
    const user = userEvent.setup();
    render(<GtmCsvImport onApply={() => {}} />);
    await user.click(screen.getByRole('button', { name: /importer un csv/i }));

    const textarea = screen.getByLabelText(/csv à importer/i);
    fireEvent.change(textarea, { target: { value: 'production,ga4MeasurementId,G-PROD0000' } });

    // Aperçu apparait
    expect(await screen.findByText(/1 variable\(s\) appliquée\(s\)/)).toBeInTheDocument();
    expect(screen.getByText('G-PROD0000')).toBeInTheDocument();
  });

  it('affiche les warnings pour les variables/envs inconnus', async () => {
    const user = userEvent.setup();
    render(<GtmCsvImport onApply={() => {}} />);
    await user.click(screen.getByRole('button', { name: /importer un csv/i }));

    const textarea = screen.getByLabelText(/csv à importer/i);
    fireEvent.change(textarea, { target: { value: 'badenv,ga4MeasurementId,G-X' } });

    // Le warning textuel mentionne badenv (en plus de la value du textarea).
    // On cherche dans la liste des warnings, pas dans le textarea.
    const warnings = await screen.findAllByText(/badenv/);
    // Au moins 2 : 1 dans le textarea, 1+ dans le warning
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('Appliquer désactivé tant qu\'il n\'y a pas de variable appliquée', async () => {
    const user = userEvent.setup();
    render(<GtmCsvImport onApply={() => {}} />);
    await user.click(screen.getByRole('button', { name: /importer un csv/i }));
    const apply = screen.getByRole('button', { name: /^appliquer$/i });
    expect(apply).toBeDisabled();
  });

  it("appelle onApply avec le résultat parsé au clic Appliquer", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<GtmCsvImport onApply={onApply} />);
    await user.click(screen.getByRole('button', { name: /importer un csv/i }));

    const textarea = screen.getByLabelText(/csv à importer/i);
    fireEvent.change(textarea, { target: { value: 'production,metaPixelId,11111111111' } });

    await user.click(screen.getByRole('button', { name: /^appliquer$/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
    const arg = onApply.mock.calls[0]![0];
    expect(arg.appliedCount).toBe(1);
    expect(arg.perEnv.production.metaPixelId).toBe('11111111111');
  });
});
