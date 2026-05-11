/**
 * RTL — MediaImageClient.
 *
 * Note: l'ancien fade-in opacity (0→1 onLoad) a été supprimé : sur certains
 * mobiles (iOS Safari ancien, Android avec décodeur AVIF capricieux, cache +
 * hydratation), le signal load pouvait ne jamais arriver et l'image restait
 * invisible. Le blurhash en background couvre la phase de chargement et
 * l'image apparaît dès que le navigateur la peint.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  it("régression mobile : pas d'opacity:0 ni de transition opacity (image visible immédiatement)", () => {
    // Garde-fou pour ne pas réintroduire le fade-in qui rendait les images
    // invisibles sur certains mobiles quand `onLoad` ne se déclenchait pas.
    const { container } = render(<MediaImageClient {...baseProps} />);
    const img = container.querySelector('img.media-img') as HTMLImageElement;
    expect(img.style.opacity).toBe('');
    expect(img.style.transition).toBe('');
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
