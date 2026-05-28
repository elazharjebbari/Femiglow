'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { RitualPhotoPublic } from '@/lib/schemas/rituals';

interface RitualPhotoLightboxProps {
  photos: RitualPhotoPublic[];
  initialIndex: number;
  alt: string;
  caption?: string | null;
  onClose: () => void;
  isOpen: boolean;
}

/**
 * Lightbox photo plein écran.
 * Nav clavier (← / → / Esc), swipe mobile via Framer drag.
 * Préchargement adjacent via <link rel="preload">.
 *
 * Cf. docs/reviews-wall/execution/05-frontend-plan-action.md § 6.2
 *    docs/reviews-wall/09-interface-publique.md § 4
 */
export function RitualPhotoLightbox({
  photos,
  initialIndex,
  alt,
  caption,
  onClose,
  isOpen,
}: RitualPhotoLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(initialIndex);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => setMounted(true), []);
  useEffect(() => setIndex(initialIndex), [initialIndex]);

  const total = photos.length;

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + total) % total);
  }, [total]);
  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % total);
  }, [total]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft' && total > 1) {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight' && total > 1) {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, total, goPrev, goNext, onClose]);

  useEffect(() => {
    if (isOpen) closeBtnRef.current?.focus();
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const photo = photos[index];
  if (!photo) return null;

  const variants = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.08 },
      }
    : {
        initial: { opacity: 0, scale: 0.96 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.96 },
        transition: { duration: 0.24, ease: [0.65, 0, 0.35, 1] },
      };

  return createPortal(
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Photo en plein écran"
        className="fixed inset-0 z-[400] flex flex-col items-center justify-center bg-black/95 p-4"
        {...variants}
        data-testid="ritual-photo-lightbox"
      >
        <header className="absolute top-4 inset-x-4 flex items-center justify-between">
          <span className="font-inter text-xs text-white/70">
            Photo {index + 1} / {total}
          </span>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer la photo"
            data-testid="ritual-photo-lightbox-close"
            className="inline-flex h-11 w-11 items-center justify-center text-white hover:bg-white/10"
          >
            <span aria-hidden="true" className="text-xl">✕</span>
          </button>
        </header>

        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Photo précédente"
              data-testid="ritual-photo-lightbox-prev"
              onClick={goPrev}
              className="absolute start-4 z-10 inline-flex h-12 w-12 items-center justify-center bg-white/10 text-white hover:bg-white/20"
            >
              <span aria-hidden="true" className="rtl:rotate-180 inline-block">←</span>
            </button>
            <button
              type="button"
              aria-label="Photo suivante"
              data-testid="ritual-photo-lightbox-next"
              onClick={goNext}
              className="absolute end-4 z-10 inline-flex h-12 w-12 items-center justify-center bg-white/10 text-white hover:bg-white/20"
            >
              <span aria-hidden="true" className="rtl:rotate-180 inline-block">→</span>
            </button>
          </>
        )}

        <div className="relative flex max-h-[80vh] w-full max-w-[90vw] items-center justify-center">
          <Image
            src={photo.url}
            alt={photo.alt ?? alt}
            width={photo.width}
            height={photo.height}
            className="h-auto max-h-[80vh] w-auto max-w-full object-contain"
            priority
          />
        </div>

        {(photo.alt || caption) && (
          <footer className="absolute bottom-4 inset-x-4 text-center font-cormorant text-sm italic text-white/80">
            {photo.alt ?? caption}
          </footer>
        )}

        {/* Préchargement photos adjacentes */}
        {total > 1 && (
          <>
            <link rel="preload" as="image" href={photos[(index - 1 + total) % total]?.url} />
            <link rel="preload" as="image" href={photos[(index + 1) % total]?.url} />
          </>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
