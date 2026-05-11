'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  menuEntries,
  menuSeasonLabel,
  menuSignature,
} from '@/lib/menu-descriptions';
import { cn } from '@/lib/utils/cn';

interface SommaireOverlayProps {
  open: boolean;
  onClose: () => void;
}

const overlayEase = [0.22, 1, 0.36, 1] as const;

export function SommaireOverlay({ open, onClose }: SommaireOverlayProps) {
  const titleId = useId();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const root = containerRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  const overlayVariants = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.2 } },
        exit: { opacity: 0, transition: { duration: 0.16 } },
      }
    : {
        initial: { opacity: 0, y: '-2%' },
        animate: {
          opacity: 1,
          y: '0%',
          transition: { duration: 0.48, ease: overlayEase },
        },
        exit: {
          opacity: 0,
          y: '-1%',
          transition: { duration: 0.32, ease: [0.4, 0, 1, 1] },
        },
      };

  const itemVariants = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.16 } },
      }
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.36, ease: overlayEase } },
      };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sommaire"
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-0 z-[var(--z-modal)] flex flex-col bg-creme"
        >
          <h2 id={titleId} className="sr-only">
            Sommaire de navigation
          </h2>

          <header className="flex h-[72px] items-center justify-between px-6 md:h-[72px] lg:px-12">
            <Link
              href="/"
              onClick={onClose}
              aria-label="FemiGlow — Accueil"
              className="font-script text-2xl leading-none text-encre transition-opacity hover:opacity-70 md:text-[26px]"
            >
              FemiGlow
            </Link>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="font-body text-[11px] uppercase tracking-[0.2em] text-encre underline decoration-encre/40 underline-offset-4 transition-colors hover:decoration-encre md:text-xs"
            >
              Fermer
            </button>
          </header>

          <motion.p
            variants={itemVariants}
            initial="initial"
            animate="animate"
            transition={{ delay: reduceMotion ? 0 : 0.18 }}
            className="px-6 font-body text-[10px] uppercase tracking-[0.22em] text-encre/40 lg:px-12"
          >
            {menuSeasonLabel}
          </motion.p>

          <ul className="mx-auto mt-10 flex w-full max-w-[var(--max-width-page)] flex-1 flex-col gap-y-8 px-6 md:mt-14 md:gap-y-10 lg:px-[14vw]">
            {menuEntries.map((entry, index) => {
              const active = pathname === entry.href;
              return (
                <motion.li
                  key={entry.href}
                  variants={itemVariants}
                  initial="initial"
                  animate="animate"
                  transition={{
                    delay: reduceMotion ? 0 : 0.22 + index * 0.09,
                    duration: 0.36,
                    ease: overlayEase,
                  }}
                >
                  <Link
                    href={entry.href}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className="group flex items-start gap-4 md:gap-8"
                  >
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'font-display text-[32px] italic leading-[1.05] text-encre md:text-[56px]',
                          'relative inline-block',
                        )}
                      >
                        {entry.label}
                        <span
                          aria-hidden="true"
                          className={cn(
                            'pointer-events-none absolute -bottom-1 left-0 h-px bg-encre transition-all duration-[350ms] ease-out',
                            active
                              ? 'w-full opacity-100 [height:1.5px]'
                              : 'w-0 opacity-80 group-hover:w-full group-focus-visible:w-full',
                            reduceMotion && 'transition-none',
                          )}
                        />
                      </span>
                      <p className="mt-2 font-body text-xs leading-[1.55] text-encre/55 md:text-[13px]">
                        {entry.description}
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="relative ml-auto mt-2 block h-14 w-14 shrink-0 overflow-hidden rounded-[2px] bg-encre/5 sm:h-16 sm:w-16 md:h-[88px] md:w-[88px]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.vignette.src}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </span>
                  </Link>
                </motion.li>
              );
            })}
          </ul>

          <motion.div
            variants={itemVariants}
            initial="initial"
            animate="animate"
            transition={{ delay: reduceMotion ? 0 : 0.22 + menuEntries.length * 0.09 }}
            className="mx-auto flex w-full max-w-[var(--max-width-page)] items-end justify-end px-6 pb-8 pt-12 lg:px-[14vw]"
          >
            <span className="font-script text-base text-encre/55 md:text-lg">
              {menuSignature}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
