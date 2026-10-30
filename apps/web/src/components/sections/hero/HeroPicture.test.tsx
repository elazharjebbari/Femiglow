import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HeroGalleryImage } from '@/lib/products/hero-gallery-types';
import { HeroPicture } from './HeroPicture';
import {
  HERO_PICTURE_DESKTOP_MEDIA,
  HERO_PICTURE_DESKTOP_SIZES,
  HERO_PICTURE_MOBILE_MEDIA,
  heroPicturePreloads,
  heroPictureSources,
  pickSrcSetCandidate,
} from './hero-picture-props';

const plain: HeroGalleryImage = {
  id: 'p',
  src: '/products/kit.jpg',
  alt: 'Pack',
  width: 1200,
  height: 1500,
  kind: 'product',
};

const artDirected: HeroGalleryImage = {
  ...plain,
  id: 'a',
  src: '/_media/e-fr-desktop.webp',
  blurDataURL: 'data:image/webp;base64,AAA',
  objectPosition: '50% 30%',
  mobile: { src: '/_media/e-fr-mobile.webp', width: 1200, height: 1600 },
};

describe('HeroPicture', () => {
  it('sans version mobile : next/image classique, aucun <picture>', () => {
    const { container } = render(<HeroPicture image={plain} sizes="100vw" priority />);
    expect(container.querySelector('picture')).toBeNull();
    const img = container.querySelector('img')!;
    expect(img.getAttribute('alt')).toBe('Pack');
    expect(img.getAttribute('sizes')).toBe('100vw');
    expect(img.className).toBe('object-cover');
  });

  it('avec version mobile : <picture> + <source media> mobile + <img> desktop', () => {
    const { container } = render(<HeroPicture image={artDirected} sizes="100vw" priority />);
    const picture = container.querySelector('picture')!;
    expect(picture).not.toBeNull();
    const source = picture.querySelector('source')!;
    expect(source.getAttribute('media')).toBe(HERO_PICTURE_MOBILE_MEDIA);
    expect(source.getAttribute('srcset')).toContain(encodeURIComponent('/_media/e-fr-mobile.webp'));
    expect(source.getAttribute('sizes')).toBe('100vw');
    const img = picture.querySelector('img')!;
    expect(img.getAttribute('src')).toContain(encodeURIComponent('/_media/e-fr-desktop.webp'));
    // `sizes` constants (le `sizes` de l'appelant est ignoré) → déduplication.
    expect(img.getAttribute('sizes')).toBe(HERO_PICTURE_DESKTOP_SIZES);
    expect(img.getAttribute('alt')).toBe('Pack');
    expect(img.style.objectPosition).toBe('50% 30%');
  });

  it('priorité : fetchpriority=high et pas de lazy ; sinon loading=lazy', () => {
    const high = render(<HeroPicture image={artDirected} sizes="100vw" priority />).container;
    const hImg = high.querySelector('img')!;
    expect(hImg.getAttribute('fetchpriority') ?? hImg.getAttribute('fetchPriority')).toBe('high');
    expect(hImg.getAttribute('loading')).not.toBe('lazy');

    const low = render(<HeroPicture image={artDirected} sizes="100vw" />).container;
    const lImg = low.querySelector('img')!;
    expect(lImg.getAttribute('loading')).toBe('lazy');
    expect(lImg.getAttribute('fetchpriority')).toBeNull();
  });

  it('même <picture> quel que soit le `sizes` de l’appelant (arbres mobile et desktop)', () => {
    const a = render(<HeroPicture image={artDirected} sizes="100vw" priority />).container.innerHTML;
    const b = render(
      <HeroPicture image={artDirected} sizes="(min-width: 1024px) 40vw, 100vw" priority />,
    ).container.innerHTML;
    expect(a).toBe(b);
  });
});

describe('heroPicturePreloads', () => {
  it('aucun preload sans art direction (next/image s’en charge)', () => {
    expect(heroPicturePreloads(plain)).toEqual([]);
    expect(heroPicturePreloads(undefined)).toEqual([]);
  });

  it('un preload par media query, chacun avec SA source', () => {
    const preloads = heroPicturePreloads(artDirected);
    expect(preloads).toHaveLength(2);
    const [mobile, desktop] = preloads;
    expect(mobile).toMatchObject({ media: HERO_PICTURE_MOBILE_MEDIA, imageSizes: '100vw' });
    expect(mobile!.imageSrcSet).toContain(encodeURIComponent('/_media/e-fr-mobile.webp'));
    expect(desktop).toMatchObject({
      media: HERO_PICTURE_DESKTOP_MEDIA,
      imageSizes: HERO_PICTURE_DESKTOP_SIZES,
    });
    expect(desktop!.imageSrcSet).toContain(encodeURIComponent('/_media/e-fr-desktop.webp'));
  });
});

describe('pickSrcSetCandidate', () => {
  const srcSet = '/i?w=640 640w, /i?w=828 828w, /i?w=1200 1200w, /i?w=3840 3840w';
  it('plus petit candidat ≥ cible, sinon le plus grand, sinon le repli', () => {
    expect(pickSrcSetCandidate(srcSet, 828, '/f')).toBe('/i?w=828');
    expect(pickSrcSetCandidate(srcSet, 900, '/f')).toBe('/i?w=1200');
    expect(pickSrcSetCandidate(srcSet, 5000, '/f')).toBe('/i?w=3840');
    expect(pickSrcSetCandidate(undefined, 828, '/f')).toBe('/f');
    expect(pickSrcSetCandidate('garbage', 828, '/f')).toBe('/f');
  });
});

describe('flou de chargement (art direction)', () => {
  it('seulement sur l’image LCP (priority) ; aucune slide lazy ne l’embarque', () => {
    const lcp = heroPictureSources(artDirected, { priority: true })!;
    expect(String(lcp.desktop.style?.backgroundImage)).toContain('data:image/webp;base64,AAA');
    const lazy = heroPictureSources(artDirected, { priority: false })!;
    expect(lazy.desktop.style?.backgroundImage).toBeUndefined();
    // Jamais sur la source mobile (un <source> n'a pas de placeholder).
    expect(lcp.mobile.style?.backgroundImage).toBeUndefined();
  });
});
