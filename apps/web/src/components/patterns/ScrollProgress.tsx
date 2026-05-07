'use client';

import { LazyMotion, domAnimation, m, useScroll, useReducedMotion } from 'framer-motion';

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 z-sticky h-[2px] origin-left bg-sauge-dark/80"
        style={{ scaleX: scrollYProgress }}
      />
    </LazyMotion>
  );
}
