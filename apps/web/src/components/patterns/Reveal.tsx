'use client';

import { LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

type Direction = 'up' | 'right' | 'none';

interface RevealProps {
  children: ReactNode;
  delay?: number;
  direction?: Direction;
  distance?: number;
  duration?: number;
  className?: string;
  once?: boolean;
}

const directionOffsets: Record<Direction, (d: number) => { x: number; y: number }> = {
  up: (d) => ({ x: 0, y: d }),
  right: (d) => ({ x: -d, y: 0 }),
  none: () => ({ x: 0, y: 0 }),
};

export function Reveal({
  children,
  delay = 0,
  direction = 'up',
  distance = 16,
  duration = 0.6,
  className,
  once = true,
}: RevealProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const offset = directionOffsets[direction](distance);

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        className={className}
        initial={{ opacity: 0, x: offset.x, y: offset.y }}
        whileInView={{ opacity: 1, x: 0, y: 0 }}
        viewport={{ once, margin: '-10% 0px' }}
        transition={{
          duration,
          delay: delay / 1000,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
