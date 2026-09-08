'use client';

import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import type { HeroGalleryImage } from '@/lib/products/hero-gallery-types';
import { useGallery } from './useGallery';
import { HeroGalleryMain } from './HeroGalleryMain';
import { HeroGalleryThumbnails } from './HeroGalleryThumbnails';
import { HeroGalleryArrow } from './HeroGalleryArrow';

export interface HeroGalleryProps {
  images: HeroGalleryImage[];
  initialIndex?: number;
  ariaLabel?: string;
  /** Affichage des thumbnails desktop. Default true. */
  showThumbnails?: boolean;
  /** Callback à chaque changement d'image (analytics). */
  onChange?: (index: number, image: HeroGalleryImage) => void;
  className?: string;
}

/**
 * Galerie hero produit — orchestrateur.
 *
 *  Mobile (< 1024px) : snap-scroll horizontal + dots indicator
 *  Desktop (≥ 1024px) : thumbnails verticales + image principale + flèches
 *
 * Le composant rend SIMULTANÉMENT les deux structures (mobile + desktop)
 * et utilise Tailwind `lg:hidden` / `hidden lg:block` pour basculer.
 * Ça évite l'hydration mismatch lié à `useMediaQuery` (false au SSR,
 * vrai/faux au client selon viewport réel).
 *
 * Accessibilité : `role=region` + clavier ←→ + `aria-current` sur les
 * vignettes/dots actifs + respect de `prefers-reduced-motion`.
 */
export function HeroGallery({
  images,
  initialIndex = 0,
  ariaLabel = 'Galerie produit',
  showThumbnails = true,
  onChange,
  className,
}: HeroGalleryProps): JSX.Element | null {
  const reducedMotion = useReducedMotion();
  const { currentIndex, setIndex, next, prev } = useGallery({
    count: images.length,
    initialIndex,
  });

  useEffect(() => {
    const img = images[currentIndex];
    if (img) onChange?.(currentIndex, img);
  }, [currentIndex, images, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (images.length <= 1) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'Home') {
        e.preventDefault();
        setIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setIndex(images.length - 1);
      }
    },
    [images.length, next, prev, setIndex],
  );

  const firstImage = images[0];
  if (!firstImage) return null;

  if (images.length === 1) {
    return (
      <div className={cn('w-full', className)}>
        <HeroGalleryMain image={firstImage} priority />
      </div>
    );
  }

  const activeImage = images[currentIndex] ?? firstImage;

  return (
    <div
      role="region"
      aria-roledescription="carrousel"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      className={cn('w-full focus:outline-none', className)}
    >
      {/* ─── Desktop layout (lg+) ─── */}
      <div className="hidden lg:flex lg:gap-4">
        {showThumbnails ? (
          <div className="shrink-0">
            <HeroGalleryThumbnails
              images={images}
              currentIndex={currentIndex}
              onSelect={setIndex}
            />
          </div>
        ) : null}
        <div className="group/gallery relative min-w-0 flex-1">
          <HeroGalleryMain image={activeImage} priority={currentIndex === 0} />
          <HeroGalleryArrow direction="prev" onClick={prev} />
          <HeroGalleryArrow direction="next" onClick={next} />
        </div>
      </div>

      {/* ─── Mobile layout (< lg) ─── */}
      <div className="lg:hidden">
        <MobileSnapScroll
          images={images}
          currentIndex={currentIndex}
          onIndexChange={setIndex}
          reducedMotion={reducedMotion}
        />
        {/* Vignettes sélectionnables sous le carousel (images secondaires). */}
        {showThumbnails ? (
          <HeroGalleryThumbnails
            orientation="horizontal"
            images={images}
            currentIndex={currentIndex}
            onSelect={setIndex}
            className="mt-3"
          />
        ) : null}
        <div
          className="flex items-center justify-center pt-3 text-[12px] tabular-nums text-encre/60"
          aria-live="polite"
        >
          <span className="font-medium text-encre/80">{currentIndex + 1}</span>
          <span className="mx-1">/</span>
          <span>{images.length}</span>
        </div>
      </div>
    </div>
  );
}

interface MobileSnapScrollProps {
  images: HeroGalleryImage[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  reducedMotion: boolean;
}

/**
 * Carrousel mobile en scroll-snap natif. On utilise IntersectionObserver
 * pour synchroniser l'index avec le swipe utilisateur, et `scrollIntoView`
 * pour reagir aux changements programmatiques (click sur dot).
 */
function MobileSnapScroll({
  images,
  currentIndex,
  onIndexChange,
  reducedMotion,
}: MobileSnapScrollProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastProgrammaticIndex = useRef(currentIndex);
  // Cooldown post-détection : empêche l'observer d'émettre plusieurs changements
  // pendant l'inertia d'un swipe rapide (cause du bug "1 → 5").
  const lastDetectedAt = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const slide = container.children[currentIndex] as HTMLElement | undefined;
    if (!slide) return;
    lastProgrammaticIndex.current = currentIndex;
    slide.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [currentIndex, reducedMotion]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const COOLDOWN_MS = 120;
    const observer = new IntersectionObserver(
      (entries) => {
        const now = performance.now();
        if (now - lastDetectedAt.current < COOLDOWN_MS) return;
        // Seuil 0.7 (vs 0.6 avant) : pendant un swipe rapide, plusieurs slides
        // dépassent 0.6 simultanément. À 0.7 le pick est stable sur la slide
        // effectivement snappée par le navigateur.
        const visible = entries.find(
          (e) => e.isIntersecting && e.intersectionRatio >= 0.7,
        );
        if (!visible) return;
        const idx = Array.from(container.children).indexOf(visible.target);
        if (idx === -1 || idx === lastProgrammaticIndex.current) return;
        lastDetectedAt.current = now;
        onIndexChange(idx);
      },
      { root: container, threshold: 0.7 },
    );
    Array.from(container.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [onIndexChange, images.length]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain',
        'scroll-smooth',
        '[-ms-overflow-style:none] [scrollbar-width:none]',
        '[&::-webkit-scrollbar]:hidden',
      )}
      style={{ touchAction: 'pan-x pan-y' }}
      aria-live="polite"
    >
      {images.map((img, i) => (
        <div
          key={img.id}
          // `snap-always` (scroll-snap-stop: always) force le navigateur à
          // s'arrêter à CHAQUE slide adjacente — sans ça, un swipe vif peut
          // traverser plusieurs slides en un seul mouvement (bug "1 → 5").
          className="w-full shrink-0 snap-center snap-always"
          data-slide-index={i}
          role="group"
          aria-roledescription="diapositive"
          aria-label={`${i + 1} sur ${images.length}`}
        >
          <HeroGalleryMain
            image={img}
            priority={i === 0}
            sizes="100vw"
            aspectRatio="3 / 4"
          />
        </div>
      ))}
    </div>
  );
}
