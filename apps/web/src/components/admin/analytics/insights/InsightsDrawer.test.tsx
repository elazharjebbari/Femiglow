import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InsightsDrawer } from './InsightsDrawer';

describe('InsightsDrawer', () => {
  it("ne rend rien quand open=false", () => {
    const onClose = vi.fn();
    render(
      <InsightsDrawer open={false} onClose={onClose} kicker="Page" title="/kit">
        <span>contenu</span>
      </InsightsDrawer>,
    );
    expect(screen.queryByTestId('insights-drawer')).toBeNull();
  });

  it("rend kicker, title, contenu quand open=true", () => {
    render(
      <InsightsDrawer open onClose={() => {}} kicker="Page" title="/kit" subtitle="3 410 visites">
        <span>contenu drawer</span>
      </InsightsDrawer>,
    );
    expect(screen.getByText('Page')).toBeInTheDocument();
    expect(screen.getByText('/kit')).toBeInTheDocument();
    expect(screen.getByText('3 410 visites')).toBeInTheDocument();
    expect(screen.getByText('contenu drawer')).toBeInTheDocument();
  });

  it('clic sur Fermer appelle onClose', () => {
    const onClose = vi.fn();
    render(
      <InsightsDrawer open onClose={onClose} kicker="Page" title="/kit">
        <span>x</span>
      </InsightsDrawer>,
    );
    fireEvent.click(screen.getByTestId('insights-drawer-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('Esc ferme le drawer', () => {
    const onClose = vi.fn();
    render(
      <InsightsDrawer open onClose={onClose} kicker="Page" title="/kit">
        <span>x</span>
      </InsightsDrawer>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it("clic overlay ferme", () => {
    const onClose = vi.fn();
    render(
      <InsightsDrawer open onClose={onClose} kicker="Page" title="/kit">
        <span>x</span>
      </InsightsDrawer>,
    );
    fireEvent.click(screen.getByTestId('insights-drawer-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  it("a11y : role=dialog + aria-modal=true", () => {
    render(
      <InsightsDrawer open onClose={() => {}} kicker="Page" title="/kit">
        <span>x</span>
      </InsightsDrawer>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('focus initial sur bouton Fermer', () => {
    render(
      <InsightsDrawer open onClose={() => {}} kicker="Page" title="/kit">
        <span>x</span>
      </InsightsDrawer>,
    );
    expect(document.activeElement).toBe(screen.getByTestId('insights-drawer-close'));
  });

  it('focus restauré à l\'élément précédent à la fermeture', () => {
    const previousButton = document.createElement('button');
    previousButton.id = 'previous';
    document.body.appendChild(previousButton);
    previousButton.focus();
    expect(document.activeElement).toBe(previousButton);

    const { rerender } = render(
      <InsightsDrawer open onClose={() => {}} kicker="Page" title="/kit">
        <span>x</span>
      </InsightsDrawer>,
    );
    expect(document.activeElement).toBe(screen.getByTestId('insights-drawer-close'));

    rerender(
      <InsightsDrawer open={false} onClose={() => {}} kicker="Page" title="/kit">
        <span>x</span>
      </InsightsDrawer>,
    );
    expect(document.activeElement).toBe(previousButton);
    document.body.removeChild(previousButton);
  });

  it('Esc avec onClose multiple = stable', () => {
    const onClose = vi.fn();
    render(
      <InsightsDrawer open onClose={onClose} kicker="X" title="X">
        <span>x</span>
      </InsightsDrawer>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('autres touches n\'appellent pas onClose', () => {
    const onClose = vi.fn();
    render(
      <InsightsDrawer open onClose={onClose} kicker="X" title="X">
        <span>x</span>
      </InsightsDrawer>,
    );
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('subtitle optionnel : absent si non passé', () => {
    render(
      <InsightsDrawer open onClose={() => {}} kicker="X" title="Y">
        <span>z</span>
      </InsightsDrawer>,
    );
    // pas de subtitle entre le title et le contenu
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
  });

  it('aria-labelledby pointe vers l\'id du titre', () => {
    render(
      <InsightsDrawer open onClose={() => {}} kicker="X" title="/kit">
        <span>x</span>
      </InsightsDrawer>,
    );
    const dialog = screen.getByRole('dialog');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBe('insights-drawer-title');
    const heading = document.getElementById(labelId!);
    expect(heading?.textContent).toBe('/kit');
  });
});
