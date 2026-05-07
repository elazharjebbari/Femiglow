/**
 * Tests d'intégration : flow onboarding complet sur GtmConfigForm.
 *
 * Vérifie que les nouveaux helpers (template + CSV import) intègrent bien
 * avec le formulaire et la propagation broadcast.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GtmConfigForm } from './GtmConfigForm';

describe('GtmConfigForm — flow onboarding (template + form)', () => {
  it('après application d\'un template, le formulaire affiche les valeurs propagées', async () => {
    const user = userEvent.setup();
    render(<GtmConfigForm onSubmit={async () => {}} />);

    // Étape 1 : ouvrir le picker
    await user.click(screen.getByRole('button', { name: /partir d.un template/i }));

    // Étape 2 : sélectionner Maroc e-commerce
    const cards = screen.getAllByRole('button', { pressed: false });
    const marocCard = cards.find((c) => c.textContent?.match(/E-commerce Maroc/i));
    expect(marocCard).toBeDefined();
    await user.click(marocCard!);

    // Étape 3 : appliquer
    await user.click(screen.getByRole('button', { name: /appliquer le template/i }));

    // Le template Maroc e-commerce a defaultCurrency=MAD pour tous les envs
    const currencyInputs = screen.getAllByPlaceholderText('MAD');
    for (const inp of currencyInputs) {
      expect((inp as HTMLInputElement).value).toBe('MAD');
    }
  });

  it('flow complet : template Sandbox → propagation manuelle prod→tous → submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<GtmConfigForm onSubmit={onSubmit} />);

    // Appliquer template Sandbox (active GA4 dev seul)
    await user.click(screen.getByRole('button', { name: /partir d.un template/i }));
    const cards = screen.getAllByRole('button', { pressed: false });
    const sandbox = cards.find((c) => c.textContent?.match(/Sandbox/i));
    await user.click(sandbox!);
    await user.click(screen.getByRole('button', { name: /appliquer le template/i }));

    // Saisir le nom + un GA4 ID en prod
    await user.type(screen.getByPlaceholderText(/v1/i), 'flow-test-1');
    const ga4Inputs = screen.getAllByPlaceholderText('G-XXXXXXX');
    await user.type(ga4Inputs[0]!, 'G-PROD0001');

    // Propager la valeur prod vers tous via "Tous"
    const tousBtns = screen.getAllByRole('button', { name: /^Tous$/ });
    await user.click(tousBtns[0]!);

    // Vérifier que les 3 autres envs ont reçu G-PROD0001
    expect((ga4Inputs[1] as HTMLInputElement).value).toBe('G-PROD0001');
    expect((ga4Inputs[2] as HTMLInputElement).value).toBe('G-PROD0001');
    expect((ga4Inputs[3] as HTMLInputElement).value).toBe('G-PROD0001');

    // Submit
    await user.click(screen.getByRole('button', { name: /créer la version/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0]![0];
    expect(arg.name).toBe('flow-test-1');
    // Le template Sandbox + GA4 propagé → toutes les valeurs cohérentes
    expect(arg.perEnv.production.ga4MeasurementId).toBe('G-PROD0001');
    expect(arg.perEnv.dev.ga4MeasurementId).toBe('G-PROD0001');
  });
});

describe('GtmConfigForm — flow onboarding (CSV)', () => {
  it('import CSV remplit le formulaire et permet le submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<GtmConfigForm onSubmit={onSubmit} />);

    // Ouvrir le CSV import
    await user.click(screen.getByRole('button', { name: /importer un csv/i }));

    // Type CSV via fireEvent.change (plus rapide que userEvent.type)
    const { fireEvent } = await import('@testing-library/react');
    const textarea = screen.getByLabelText(/csv à importer/i);
    fireEvent.change(textarea, {
      target: {
        value: [
          'production,ga4MeasurementId,G-PROD0000',
          'production,metaPixelId,11111111111',
          'stage,ga4MeasurementId,G-STAGE000',
        ].join('\n'),
      },
    });

    // Aperçu visible
    await screen.findByText(/3 variable\(s\) appliquée\(s\)/i);

    // Appliquer
    await user.click(screen.getByRole('button', { name: /^appliquer$/i }));

    // Le textarea dans la modale ferme. On doit voir les valeurs dans le form.
    const ga4Inputs = screen.getAllByPlaceholderText('G-XXXXXXX');
    expect((ga4Inputs[0] as HTMLInputElement).value).toBe('G-PROD0000');
    expect((ga4Inputs[1] as HTMLInputElement).value).toBe('G-STAGE000');

    // Submit
    await user.type(screen.getByPlaceholderText(/v1/i), 'csv-flow');
    await user.click(screen.getByRole('button', { name: /créer la version/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0]![0];
    expect(arg.perEnv.production.metaPixelId).toBe('11111111111');
  });
});

describe('GtmConfigForm — sécurité du flow', () => {
  it("submit désactivé tant que le nom est vide même avec template appliqué", async () => {
    const user = userEvent.setup();
    render(<GtmConfigForm onSubmit={async () => {}} />);

    await user.click(screen.getByRole('button', { name: /partir d.un template/i }));
    const cards = screen.getAllByRole('button', { pressed: false });
    await user.click(cards.find((c) => c.textContent?.match(/Minimal/i))!);
    await user.click(screen.getByRole('button', { name: /appliquer le template/i }));

    // Sans saisir de nom → submit reste désactivé
    expect(screen.getByRole('button', { name: /créer la version/i })).toBeDisabled();
  });
});
