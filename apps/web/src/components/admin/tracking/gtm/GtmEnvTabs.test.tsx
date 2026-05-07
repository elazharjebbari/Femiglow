import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GtmEnvTabs, envBadge, type GtmEnv } from './GtmEnvTabs';

function setup(initial: GtmEnv = 'production') {
  const onChange = vi.fn();
  const utils = render(<GtmEnvTabs value={initial} onChange={onChange} />);
  return { ...utils, onChange };
}

describe('GtmEnvTabs — ARIA & rendu', () => {
  it('rend un tablist avec 4 tabs', () => {
    setup();
    const tablist = screen.getByRole('tablist', { name: /environnement/i });
    expect(tablist).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('marque le tab actif avec aria-selected="true" et tabIndex 0', () => {
    setup('preview');
    const previewTab = screen.getByRole('tab', { name: /preview/i });
    expect(previewTab.getAttribute('aria-selected')).toBe('true');
    expect(previewTab.getAttribute('tabindex')).toBe('0');

    const prodTab = screen.getByRole('tab', { name: /production/i });
    expect(prodTab.getAttribute('aria-selected')).toBe('false');
    expect(prodTab.getAttribute('tabindex')).toBe('-1');
  });

  it('affiche les hints de pixels par environnement', () => {
    setup();
    expect(screen.getByText(/6 pixels/i)).toBeInTheDocument();
    expect(screen.getAllByText(/GA4 seul/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/aucun pixel/i)).toBeInTheDocument();
  });
});

describe('GtmEnvTabs — interactions clic', () => {
  it('appelle onChange au clic sur un tab', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getByRole('tab', { name: /stage/i }));
    expect(onChange).toHaveBeenCalledWith('stage');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('ne déclenche pas onChange quand disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GtmEnvTabs value="production" onChange={onChange} disabled />);
    await user.click(screen.getByRole('tab', { name: /stage/i }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('GtmEnvTabs — navigation clavier', () => {
  it('flèche droite navigue au tab suivant', () => {
    const { onChange } = setup('production');
    const prodTab = screen.getByRole('tab', { name: /production/i });
    prodTab.focus();
    fireEvent.keyDown(prodTab, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('stage');
  });

  it('flèche gauche navigue au tab précédent (wrap-around)', () => {
    const { onChange } = setup('production');
    const prodTab = screen.getByRole('tab', { name: /production/i });
    prodTab.focus();
    fireEvent.keyDown(prodTab, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('dev');
  });

  it('Home navigue au premier tab', () => {
    const { onChange } = setup('preview');
    const previewTab = screen.getByRole('tab', { name: /preview/i });
    previewTab.focus();
    fireEvent.keyDown(previewTab, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith('production');
  });

  it('End navigue au dernier tab', () => {
    const { onChange } = setup('production');
    const prodTab = screen.getByRole('tab', { name: /production/i });
    prodTab.focus();
    fireEvent.keyDown(prodTab, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith('dev');
  });

  it('ignore les autres touches', () => {
    const { onChange } = setup();
    const prodTab = screen.getByRole('tab', { name: /production/i });
    prodTab.focus();
    fireEvent.keyDown(prodTab, { key: 'Enter' });
    fireEvent.keyDown(prodTab, { key: 'a' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('envBadge', () => {
  it.each([
    ['production', 'Production', 'A8C4A6'],
    ['stage', 'Stage', 'C8A876'],
    ['preview', 'Preview', '7AA8C0'],
    ['dev', 'Dev local', 'stone-200'],
  ] as const)('badge %s : label=%s, classes contiennent %s', (env, label, marker) => {
    const b = envBadge(env);
    expect(b.label).toBe(label);
    expect(b.classes).toContain(marker);
  });
});
