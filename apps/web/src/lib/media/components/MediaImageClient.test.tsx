/**
 * RTL — MediaImageClient.
 *
 * Régression critique : si l'image est déjà chargée par le navigateur au
 * moment où React attache son listener `onLoad`, le composant ne doit PAS
 * rester avec opacity=0 (sinon seul le blurhash s'affiche → perception
 * « page floutée à jamais », bug constaté en prod).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MediaImageClient } from './MediaImageClient';

const baseProps = {
  byFormat: [
    { format: 'avif' as const, entries: [{ width: 800, url: '/_media/m/avif/800.avif' }] },
    { format: 'webp' as const, entries: [{ width: 800, url: '/_media/m/webp/800.webp' }] },
    { format: 'jpeg' as const, entries: [{ width: 800, url: '/_media/m/jpeg/800.jpg' }] },
  ],
  fallbackUrl: '/_media/m/jpeg/800.jpg',
  fallbackWidth: 1600,
  fallbackHeight: 900,
  alt: 'Visuel test',
  sizes: '100vw',
  loading: 'eager' as const,
  fetchPriority: 'high' as const,
  decoding: 'async' as const,
  blurDataUrl: 'data:image/svg+xml;utf8,<svg/>',
  strategy: 'eager' as const,
};

describe('MediaImageClient', () => {
  it('opacity passe à 1 après onLoad', async () => {
    const { container } = render(<MediaImageClient {...baseProps} />);
    const img = container.querySelector('img.media-img') as HTMLImageElement;
    expect(img.style.opacity).toBe('0');
    fireEvent.load(img);
    await waitFor(() => expect(img.style.opacity).toBe('1'));
  });

  it("régression: image déjà cachée au mount → opacity passe à 1 via useEffect", async () => {
    // Simule le cas réel : l'image est déjà complète/naturalWidth>0 avant
    // que React n'attache le onLoad. Le hook useEffect doit détecter
    // cet état et basculer isLoaded à true sans qu'aucun load event ne soit
    // dispatch.
    const completeSpy = vi
      .spyOn(HTMLImageElement.prototype, 'complete', 'get')
      .mockReturnValue(true);
    const widthSpy = vi
      .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
      .mockReturnValue(1600);
    try {
      const { container } = render(<MediaImageClient {...baseProps} />);
      const img = container.querySelector('img.media-img') as HTMLImageElement;
      // jamais on ne fireEvent.load — useEffect doit suffire.
      await waitFor(() => expect(img.style.opacity).toBe('1'));
    } finally {
      completeSpy.mockRestore();
      widthSpy.mockRestore();
    }
  });

  it('respecte les modes objectFit / objectPosition', () => {
    const { container } = render(
      <MediaImageClient
        {...baseProps}
        objectFit="contain"
        objectPosition="top"
      />,
    );
    const img = container.querySelector('img.media-img') as HTMLImageElement;
    expect(img.style.objectFit).toBe('contain');
    expect(img.style.objectPosition).toBe('top');
  });

  it('focal point fin (focalX/focalY) override la position', () => {
    const { container } = render(
      <MediaImageClient {...baseProps} focalX={20} focalY={75} />,
    );
    const img = container.querySelector('img.media-img') as HTMLImageElement;
    expect(img.style.objectPosition).toBe('20% 75%');
  });

  it('clamp focalX/focalY hors bornes [0,100]', () => {
    const { container } = render(
      <MediaImageClient {...baseProps} focalX={-50} focalY={250} />,
    );
    const img = container.querySelector('img.media-img') as HTMLImageElement;
    expect(img.style.objectPosition).toBe('0% 100%');
  });

  it('alt présent sur le <img>', () => {
    render(<MediaImageClient {...baseProps} />);
    expect(screen.getByAltText('Visuel test')).toBeInTheDocument();
  });

  describe('aspect-ratio (régression triptyques)', () => {
    it('par défaut, adopte le ratio source (fallbackWidth/fallbackHeight)', () => {
      const { container } = render(<MediaImageClient {...baseProps} />);
      const picture = container.querySelector('picture') as HTMLElement;
      expect(picture.style.aspectRatio).toBe('1600 / 900');
    });

    it('verrouille sur slotAspectRatio quand fourni (fix triptyque 4/5)', () => {
      // Une source 1600x900 placée dans un slot 4/5 doit adopter le ratio
      // *du slot* — sinon la grille devient hétérogène.
      const { container } = render(
        <MediaImageClient {...baseProps} slotAspectRatio="4/5" />,
      );
      const picture = container.querySelector('picture') as HTMLElement;
      // jsdom préserve la chaîne telle qu'écrite (sans normalisation
      // d'espaces) ; le ratio source 1600/900 a des espaces (template
      // littéral), le slot est utilisé brut.
      expect(picture.style.aspectRatio).toBe('4/5');
    });

    it('tolère le séparateur `:` (4:5 → 4/5)', () => {
      const { container } = render(
        <MediaImageClient {...baseProps} slotAspectRatio="4:5" />,
      );
      expect(
        (container.querySelector('picture') as HTMLElement).style.aspectRatio,
      ).toBe('4/5');
    });
  });

  describe('backgroundFill (anti-damier transparence)', () => {
    it('token `creme` → CSS variable resolue', () => {
      const { container } = render(
        <MediaImageClient {...baseProps} backgroundFill="creme" />,
      );
      const picture = container.querySelector('picture') as HTMLElement;
      expect(picture.style.backgroundColor).toBe('var(--color-creme)');
    });

    it('token `champagne-soft` → CSS variable resolue', () => {
      const { container } = render(
        <MediaImageClient {...baseProps} backgroundFill="champagne-soft" />,
      );
      const picture = container.querySelector('picture') as HTMLElement;
      expect(picture.style.backgroundColor).toBe('var(--color-champagne-soft)');
    });

    it('valeur arbitraire (hex/rgba) passe-through', () => {
      const { container } = render(
        <MediaImageClient {...baseProps} backgroundFill="#FF00AA" />,
      );
      const bg = (container.querySelector('picture') as HTMLElement).style
        .backgroundColor;
      // jsdom peut normaliser le hex en rgb() — on tolère les deux formes.
      expect(bg.toLowerCase()).toMatch(/#ff00aa|rgb\(255,\s*0,\s*170\)/);
    });

    it('sans fill → palette dominante (fallback historique)', () => {
      const { container } = render(
        <MediaImageClient
          {...baseProps}
          palette={[{ r: 100, g: 50, b: 200, hex: '#6432c8', weight: 0.6 }]}
        />,
      );
      const bg = (container.querySelector('picture') as HTMLElement).style
        .backgroundColor;
      expect(bg.toLowerCase()).toMatch(/#6432c8|rgb\(100,\s*50,\s*200\)/);
    });

    it('contain : désactive le blurhash en bg-image (évite flou étiré)', () => {
      const { container } = render(
        <MediaImageClient
          {...baseProps}
          objectFit="contain"
          backgroundFill="creme"
        />,
      );
      const picture = container.querySelector('picture') as HTMLElement;
      expect(picture.style.backgroundSize).toBe('contain');
      // En contain, le bg uni couvre le letterbox proprement, sans blurhash.
      expect(picture.style.backgroundImage).toBe('');
    });
  });
});
