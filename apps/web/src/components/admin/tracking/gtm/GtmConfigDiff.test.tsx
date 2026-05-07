import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GtmConfigDiff } from './GtmConfigDiff';
import { emptyEnvConfig, type GtmConfigVersion } from '@/lib/tracking/gtm/config-schema';

function makeVersion(name: string, prodGa4: string, metaPxl = ''): GtmConfigVersion {
  return {
    id: `${name}-id`,
    name,
    notes: null,
    createdAt: new Date().toISOString(),
    createdBy: 'admin_test',
    perEnv: {
      production: { ...emptyEnvConfig(), ga4MeasurementId: prodGa4, metaPixelId: metaPxl },
      stage: emptyEnvConfig(),
      preview: emptyEnvConfig(),
      dev: emptyEnvConfig(),
    },
  };
}

describe('GtmConfigDiff', () => {
  it('affiche le résumé avec count de différences', () => {
    const a = makeVersion('v3', 'G-PROD0001');
    const b = makeVersion('v2', 'G-PROD0000');
    render(<GtmConfigDiff a={a} b={b} />);
    // 1 ligne change : prod.ga4MeasurementId. Le count "1 champ(s) modifié(s)"
    expect(screen.getByText(/1 champ\(s\) modifié\(s\)/)).toBeInTheDocument();
  });

  it('met en surbrillance sauge les lignes modifiées', () => {
    const a = makeVersion('v3', 'G-PROD0001');
    const b = makeVersion('v2', 'G-PROD0000');
    render(<GtmConfigDiff a={a} b={b} />);
    const changedRow = screen.getByText('G-PROD0001').closest('tr');
    expect(changedRow?.getAttribute('data-changed')).toBe('1');
  });

  it('par défaut affiche seulement les différences', () => {
    const a = makeVersion('v3', 'G-PROD0001');
    const b = makeVersion('v2', 'G-PROD0000');
    render(<GtmConfigDiff a={a} b={b} />);
    expect(screen.getByText('G-PROD0001')).toBeInTheDocument();
    // Une ligne identique (ex: cookieDomain "auto") ne doit pas apparaître
    expect(screen.queryAllByText('auto').length).toBeLessThanOrEqual(0);
  });

  it('toggle "Différences seulement" affiche tout', async () => {
    const user = userEvent.setup();
    const a = makeVersion('v3', 'G-PROD0001');
    const b = makeVersion('v2', 'G-PROD0000');
    render(<GtmConfigDiff a={a} b={b} />);
    const toggle = screen.getByLabelText(/différences seulement/i);
    await user.click(toggle);
    // Maintenant on doit voir les lignes inchangées (cookieDomain "auto" × 4 envs × 2 colonnes = 8 occurrences)
    expect(screen.getAllByText('auto').length).toBeGreaterThanOrEqual(2);
  });

  it("affiche un état vide si aucune différence", () => {
    const a = makeVersion('identical', 'G-SAME000');
    const b = makeVersion('identical-bis', 'G-SAME000');
    render(<GtmConfigDiff a={a} b={b} />);
    expect(screen.getByText(/aucune différence/i)).toBeInTheDocument();
  });

  it('respecte les labels custom passés en props', () => {
    const a = makeVersion('v3', 'G-PROD0001');
    const b = makeVersion('v2', 'G-PROD0000');
    render(<GtmConfigDiff a={a} b={b} labelA="ActiveLabel" labelB="PrécédenteLabel" />);
    // Apparaît dans le résumé header + dans le table thead = au moins 2 occurrences
    expect(screen.getAllByText(/ActiveLabel/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/PrécédenteLabel/).length).toBeGreaterThanOrEqual(2);
  });

  it('affiche un ∅ pour les valeurs vides', () => {
    const a = makeVersion('v3', 'G-PROD0001', 'with-meta');
    const b = makeVersion('v2', 'G-PROD0001', '');
    render(<GtmConfigDiff a={a} b={b} />);
    // Au moins un ∅ pour la cellule meta vide de b
    expect(screen.getAllByText('∅').length).toBeGreaterThanOrEqual(1);
  });

  it('compare les enabledProviders triés', () => {
    const a: GtmConfigVersion = {
      ...makeVersion('v3', 'G-X'),
      perEnv: {
        ...makeVersion('v3', 'G-X').perEnv,
        production: {
          ...emptyEnvConfig(),
          ga4MeasurementId: 'G-X',
          enabledProviders: ['google_ga4', 'meta'],
        },
      },
    };
    const b: GtmConfigVersion = {
      ...makeVersion('v2', 'G-X'),
      perEnv: {
        ...makeVersion('v2', 'G-X').perEnv,
        production: {
          ...emptyEnvConfig(),
          ga4MeasurementId: 'G-X',
          enabledProviders: ['meta', 'google_ga4'], // ordre inversé
        },
      },
    };
    render(<GtmConfigDiff a={a} b={b} />);
    // Pas de différence détectée car triés
    expect(screen.getByText(/aucune différence/i)).toBeInTheDocument();
  });
});
