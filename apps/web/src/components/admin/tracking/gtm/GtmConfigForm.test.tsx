import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GtmConfigForm } from './GtmConfigForm';

describe('GtmConfigForm', () => {
  it('rend une ligne par variable et 4 colonnes (envs)', () => {
    render(<GtmConfigForm onSubmit={async () => {}} />);
    // Headers : prod, stage, preview, dev
    expect(screen.getByRole('columnheader', { name: 'production' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'stage' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'preview' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'dev' })).toBeInTheDocument();
    // GA4 Measurement ID est la première variable
    expect(screen.getByText(/GA4 Measurement ID/)).toBeInTheDocument();
  });

  it('le bouton submit est désactivé si le nom est vide', () => {
    render(<GtmConfigForm onSubmit={async () => {}} />);
    const submit = screen.getByRole('button', { name: /créer la version/i });
    expect(submit).toBeDisabled();
  });

  it('appelle onSubmit avec name + perEnv quand le formulaire est valide', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<GtmConfigForm onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText(/v1/), 'v1 — initial');
    // Remplit GA4 prod
    const ga4Inputs = screen.getAllByPlaceholderText('G-XXXXXXX');
    await user.type(ga4Inputs[0]!, 'G-PROD0000');
    await user.click(screen.getByRole('button', { name: /créer la version/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0]![0];
    expect(arg.name).toBe('v1 — initial');
    expect(arg.perEnv.production.ga4MeasurementId).toBe('G-PROD0000');
  });

  it('propage la valeur production vers tous les autres envs au clic sur "Tous"', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<GtmConfigForm onSubmit={onSubmit} />);

    const ga4Inputs = screen.getAllByPlaceholderText('G-XXXXXXX');
    await user.type(ga4Inputs[0]!, 'G-SHARED');
    // Bouton "Tous" sur la ligne GA4
    const allBtns = screen.getAllByRole('button', { name: /Tous/i });
    await user.click(allBtns[0]!);

    expect((ga4Inputs[1] as HTMLInputElement).value).toBe('G-SHARED');
    expect((ga4Inputs[2] as HTMLInputElement).value).toBe('G-SHARED');
    expect((ga4Inputs[3] as HTMLInputElement).value).toBe('G-SHARED');
  });

  it('propage la valeur production vers stage+preview seulement (skip dev) avec "Pub."', async () => {
    const user = userEvent.setup();
    render(<GtmConfigForm onSubmit={async () => {}} />);
    const ga4Inputs = screen.getAllByPlaceholderText('G-XXXXXXX');
    await user.type(ga4Inputs[0]!, 'G-SHARED');
    const pubBtns = screen.getAllByRole('button', { name: /Pub\./i });
    await user.click(pubBtns[0]!);
    expect((ga4Inputs[1] as HTMLInputElement).value).toBe('G-SHARED');
    expect((ga4Inputs[2] as HTMLInputElement).value).toBe('G-SHARED');
    expect((ga4Inputs[3] as HTMLInputElement).value).toBe(''); // dev intact
  });
});
