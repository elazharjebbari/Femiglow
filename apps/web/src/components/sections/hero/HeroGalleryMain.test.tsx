import NextImage from 'next/image';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils/cn';
import type { HeroGalleryImage } from '@/lib/products/hero-gallery-types';
import { HeroGalleryMain, type HeroGalleryMainProps } from './HeroGalleryMain';

/**
 * Copie conforme du `HeroGalleryMain` d'avant les images par audience
 * (PR 4). Sert de référence : sans art direction, le HTML doit rester
 * identique au caractère près (drapeau coupé = rendu inchangé).
 */
function LegacyHeroGalleryMain({
  image,
  priority = false,
  sizes = '(min-width: 1024px) 40vw, 100vw',
  className,
  aspectRatio = '4 / 5',
}: HeroGalleryMainProps): JSX.Element {
  return (
    <figure
      className={cn('relative w-full overflow-hidden rounded-md bg-[#E8EDE3]', className)}
      style={{ aspectRatio }}
    >
      <NextImage
        src={image.src}
        alt={image.alt}
        fill
        priority={priority}
        sizes={sizes}
        placeholder={image.blurDataURL ? 'blur' : 'empty'}
        blurDataURL={image.blurDataURL}
        className="object-cover"
      />
      {image.caption ? (
        <figcaption className="absolute bottom-2 end-2 rounded-full bg-encre/70 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-creme-warm">
          {image.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

const base: HeroGalleryImage = {
  id: 'p',
  src: '/products/kit-principale.png',
  alt: 'Pack FemiGlow',
  width: 1200,
  height: 1500,
  kind: 'product',
};

const cases: Array<[string, HeroGalleryMainProps]> = [
  ['image produit, défauts', { image: base }],
  ['priorité', { image: base, priority: true }],
  ['slide mobile (3/4, 100vw)', { image: base, priority: true, sizes: '100vw', aspectRatio: '3 / 4' }],
  ['flou + légende', { image: { ...base, blurDataURL: 'data:image/png;base64,AAA', caption: 'I. R. · Rabat', kind: 'review' } }],
  ['classe', { image: base, className: 'mt-2' }],
];

describe('HeroGalleryMain — sans art direction : HTML identique à l’existant', () => {
  it.each(cases)('%s', (_label, props) => {
    const current = render(<HeroGalleryMain {...props} />).container.innerHTML;
    const legacy = render(<LegacyHeroGalleryMain {...props} />).container.innerHTML;
    expect(current).toBe(legacy);
    expect(current).not.toContain('<picture');
  });
});

describe('HeroGalleryMain — art direction', () => {
  const art: HeroGalleryImage = {
    ...base,
    mobile: { src: '/_media/mobile.webp', width: 1200, height: 1600 },
  };

  it('ratio par breakpoint en CSS quand aucun ratio n’est imposé', () => {
    const { container } = render(<HeroGalleryMain image={art} priority />);
    const figure = container.querySelector('figure')!;
    expect(figure.className).toContain('aspect-[3/4]');
    expect(figure.className).toContain('lg:aspect-[4/5]');
    expect(figure.getAttribute('style')).toBeNull();
    expect(figure.querySelector('picture source')).not.toBeNull();
  });

  it('ratio explicite (slide mobile) conservé en style inline', () => {
    const { container } = render(<HeroGalleryMain image={art} aspectRatio="3 / 4" sizes="100vw" />);
    const figure = container.querySelector('figure')!;
    expect(figure.className).not.toContain('aspect-[3/4]');
    expect(figure.style.aspectRatio).toBe('3 / 4');
  });
});
