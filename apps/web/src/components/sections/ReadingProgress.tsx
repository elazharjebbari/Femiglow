'use client';

import { useEffect, useState } from 'react';

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      setProgress(value);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 right-0 top-0 z-sticky h-[2px] bg-transparent"
    >
      <div
        className="h-full origin-left bg-champagne motion-safe:transition-transform motion-safe:duration-100 motion-safe:ease-out"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
