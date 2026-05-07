/**
 * RTL — DisplayModePanel.
 *
 * Couvre :
 *  - affichage du dialog modal avec aperçu,
 *  - changement du mode d'adaptation (radio cover/contain/…),
 *  - sélection d'une position parmi les 9,
 *  - saisie du focal point fin (X/Y) override la position,
 *  - clic « Appliquer » → onApply avec le payload exact,
 *  - clic « Annuler » et touche Escape → onClose,
 *  - axe.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';
import { DisplayModePanel } from './DisplayModePanel';
import type {
  ComponentMediaBindingWithMedia,
  Media,
} from '@/lib/db/types';

const MEDIA: Media = {
  id: 'me_1',
  kind: 'image',
  source: 'upload',
  status: 'ready',
  originalUrl: '/_media/media/me_1/orig.png',
  originalWidth: 1600,
  originalHeight: 900,
  originalMime: 'image/png',
  originalSizeBytes: 100,
  originalFilename: 'orig.png',
  originalDurationMs: null,
  alt: 'Hero',
  caption: null,
  credit: null,
  slug: 'home-hero-home',
  qualityProfile: 'hero',
  loadingStrategy: 'eager',
  blurhash: null,
  phash: null,
  palette: [{ r: 170, g: 187, b: 204, hex: '#aabbcc', weight: 1 }],
  failureReason: null,
  isHero: false,
  overrides: {},
  deletedAt: null,
  createdBy: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const BINDING: ComponentMediaBindingWithMedia = {
  id: 'bnd_1',
  componentId: 'cmp_1',
  slot: 'primary',
  mediaId: 'me_1',
  loadingStrategy: 'eager',
  fetchPriority: 'high',
  priority: false,
  placeholderStrategy: 'svg',
  customAlt: null,
  displayOrder: 0,
  isActive: true,
  notes: null,
  objectFit: 'cover',
  objectPosition: 'center',
  focalX: null,
  focalY: null,
  backgroundFill: null,
  createdBy: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  media: MEDIA,
};

describe('DisplayModePanel', () => {
  it('affiche le dialog avec titre + actions', () => {
    render(
      <DisplayModePanel binding={BINDING} onClose={() => {}} onApply={() => {}} />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /réglages d'affichage/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /appliquer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /annuler/i })).toBeInTheDocument();
  });

  it('« Appliquer » envoie {fit:cover, position:center, focals:null} par défaut', () => {
    const onApply = vi.fn();
    render(
      <DisplayModePanel binding={BINDING} onClose={() => {}} onApply={onApply} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /appliquer/i }));
    expect(onApply).toHaveBeenCalledWith({
      objectFit: 'cover',
      objectPosition: 'center',
      focalX: null,
      focalY: null,
    });
  });

  it('changer le mode d\'adaptation puis Appliquer envoie le nouveau fit', () => {
    const onApply = vi.fn();
    render(
      <DisplayModePanel binding={BINDING} onClose={() => {}} onApply={onApply} />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /entier/i }));
    fireEvent.click(screen.getByRole('button', { name: /appliquer/i }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ objectFit: 'contain' }),
    );
  });

  it('cliquer une position met focalX/Y à null', () => {
    const onApply = vi.fn();
    render(
      <DisplayModePanel binding={BINDING} onClose={() => {}} onApply={onApply} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /position top$/i }));
    fireEvent.click(screen.getByRole('button', { name: /appliquer/i }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        objectPosition: 'top',
        focalX: null,
        focalY: null,
      }),
    );
  });

  it('focalX/focalY override la position', () => {
    const onApply = vi.fn();
    render(
      <DisplayModePanel binding={BINDING} onClose={() => {}} onApply={onApply} />,
    );
    // Les deux inputs number (focalX, focalY) ont le rôle ARIA "spinbutton".
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(2);
    fireEvent.change(inputs[0]!, { target: { value: '25' } });
    fireEvent.change(inputs[1]!, { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: /appliquer/i }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ focalX: 25, focalY: 80 }),
    );
  });

  it('Annuler → onClose', () => {
    const onClose = vi.fn();
    render(<DisplayModePanel binding={BINDING} onClose={onClose} onApply={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape → onClose', () => {
    const onClose = vi.fn();
    render(<DisplayModePanel binding={BINDING} onClose={onClose} onApply={() => {}} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('respecte axe', async () => {
    const { container } = render(
      <DisplayModePanel binding={BINDING} onClose={() => {}} onApply={() => {}} />,
    );
    await expectNoAxeViolations(container);
  });
});
