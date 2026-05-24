'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Wraps the page content in a subtle fade + 4px translate-up motion.
 * Keyed on pathname so Next.js route transitions re-trigger the animation.
 *
 * Respects `prefers-reduced-motion`: opacity-only with a tighter timing.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? 'root';
  const reduce = useReducedMotion();

  return (
    <motion.div
      key={pathname}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{
        duration: reduce ? 0.12 : 0.2,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{ display: 'contents' }}
    >
      {children}
    </motion.div>
  );
}
