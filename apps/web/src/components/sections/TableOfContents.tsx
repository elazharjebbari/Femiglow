'use client';

import { useEffect, useState } from 'react';
import type { ArticleHeading } from '@/lib/markdown/render';
import { cn } from '@/lib/utils/cn';

interface TableOfContentsProps {
  headings: ArticleHeading[];
}

export function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(headings[0]?.id ?? null);

  useEffect(() => {
    if (headings.length === 0) return;
    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: [0, 1] },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <nav aria-label="Sommaire" className="font-body text-sm">
      <p className="mb-4 font-display text-xs uppercase tracking-[0.18em] text-encre/50">
        Sommaire
      </p>
      <ul className="space-y-2">
        {headings.map((h) => (
          <li key={h.id} className={cn(h.depth === 3 && 'ps-4')}>
            <a
              href={`#${h.id}`}
              aria-current={activeId === h.id ? 'location' : undefined}
              className={cn(
                'block border-s border-transparent ps-3 leading-snug transition-colors',
                activeId === h.id
                  ? 'border-s-encre text-encre'
                  : 'text-encre/50 hover:text-encre',
              )}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
