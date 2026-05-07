import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GtmAdminTabs } from './GtmAdminTabs';

describe('GtmAdminTabs', () => {
  it('rend 3 onglets (Export / Configurations / Visualisation)', () => {
    render(
      <GtmAdminTabs
        panels={{
          export: <p>panel-export</p>,
          configurations: <p>panel-configs</p>,
          visualization: <p>panel-viz</p>,
        }}
      />,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
  });

  it('affiche le panel Export par défaut', () => {
    render(
      <GtmAdminTabs
        panels={{
          export: <p>panel-export</p>,
          configurations: <p>panel-configs</p>,
          visualization: <p>panel-viz</p>,
        }}
      />,
    );
    expect(screen.getByText('panel-export')).toBeInTheDocument();
    // Le panel non actif a l'attribut hidden + nous ne rendons pas son contenu.
    expect(screen.queryByText('panel-configs')).not.toBeInTheDocument();
  });

  it('change d\'onglet au clic', async () => {
    const user = userEvent.setup();
    render(
      <GtmAdminTabs
        panels={{
          export: <p>panel-export</p>,
          configurations: <p>panel-configs</p>,
          visualization: <p>panel-viz</p>,
        }}
      />,
    );
    await user.click(screen.getByRole('tab', { name: /configurations/i }));
    expect(screen.getByText('panel-configs')).toBeInTheDocument();
    expect(screen.queryByText('panel-export')).not.toBeInTheDocument();
  });

  it('marque les tabs avec aria-selected approprié', async () => {
    const user = userEvent.setup();
    render(
      <GtmAdminTabs
        panels={{
          export: <p>e</p>,
          configurations: <p>c</p>,
          visualization: <p>v</p>,
        }}
      />,
    );
    const exportTab = screen.getByRole('tab', { name: /export/i });
    expect(exportTab.getAttribute('aria-selected')).toBe('true');
    await user.click(screen.getByRole('tab', { name: /visualisation/i }));
    expect(exportTab.getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tab', { name: /visualisation/i }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('honore defaultTab', () => {
    render(
      <GtmAdminTabs
        defaultTab="visualization"
        panels={{
          export: <p>e</p>,
          configurations: <p>c</p>,
          visualization: <p>v</p>,
        }}
      />,
    );
    expect(screen.getByText('v')).toBeInTheDocument();
    expect(screen.queryByText('e')).not.toBeInTheDocument();
  });
});
