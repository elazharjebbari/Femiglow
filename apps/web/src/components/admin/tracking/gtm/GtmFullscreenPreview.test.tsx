import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GtmFullscreenPreview } from './GtmFullscreenPreview';

function content() {
  return <p data-testid="modal-body">contenu modal</p>;
}

describe('GtmFullscreenPreview — montage/démontage', () => {
  it('ne rend rien si open=false', () => {
    render(
      <GtmFullscreenPreview open={false} onClose={() => {}} title="Titre">
        {content()}
      </GtmFullscreenPreview>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rend un dialog ARIA quand open=true', () => {
    render(
      <GtmFullscreenPreview open={true} onClose={() => {}} title="Titre">
        {content()}
      </GtmFullscreenPreview>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Titre');
    expect(screen.getByTestId('modal-body')).toBeInTheDocument();
  });
});

describe('GtmFullscreenPreview — fermeture', () => {
  it('appelle onClose au clic sur le bouton "Fermer"', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <GtmFullscreenPreview open={true} onClose={onClose} title="X">
        {content()}
      </GtmFullscreenPreview>,
    );
    await user.click(screen.getByRole('button', { name: /fermer/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('appelle onClose quand on appuie sur Escape', () => {
    const onClose = vi.fn();
    render(
      <GtmFullscreenPreview open={true} onClose={onClose} title="X">
        {content()}
      </GtmFullscreenPreview>,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('verrouille le scroll du body quand ouvert', () => {
    const onClose = vi.fn();
    document.body.style.overflow = '';
    const { rerender } = render(
      <GtmFullscreenPreview open={true} onClose={onClose} title="X">
        {content()}
      </GtmFullscreenPreview>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender(
      <GtmFullscreenPreview open={false} onClose={onClose} title="X">
        {content()}
      </GtmFullscreenPreview>,
    );
    expect(document.body.style.overflow).toBe('');
  });
});
