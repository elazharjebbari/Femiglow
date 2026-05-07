'use client';

import { useState } from 'react';

interface ShareButtonsProps {
  url: string;
  title: string;
}

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback('Lien copié.');
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback('La copie n\u2019a pas abouti.');
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const mailHref = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;
  const linkedInHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  const baseBtn =
    'inline-flex items-center gap-2 border border-encre/20 px-4 py-3 font-body text-sm uppercase tracking-[0.15em] text-encre transition-colors hover:border-encre focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre/40 focus-visible:ring-offset-4 focus-visible:ring-offset-creme';

  return (
    <div className="flex flex-col gap-3 border-t border-encre/10 pt-8">
      <p className="font-display text-xs uppercase tracking-[0.18em] text-encre/50">
        Partager
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onCopy} className={baseBtn}>
          Copier le lien
        </button>
        <a href={mailHref} className={baseBtn}>
          Envoyer par email
        </a>
        <a
          href={linkedInHref}
          target="_blank"
          rel="noopener noreferrer"
          className={baseBtn}
        >
          Partager sur LinkedIn
        </a>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="min-h-[1.25rem] text-sm text-encre/60"
      >
        {feedback ?? ''}
      </p>
    </div>
  );
}
