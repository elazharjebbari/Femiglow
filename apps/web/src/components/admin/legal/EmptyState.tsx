import Link from 'next/link';

interface Props {
  title: string;
  description: string;
  ctaHref?: string;
  ctaLabel?: string;
}

export function LegalEmptyState({ title, description, ctaHref, ctaLabel }: Props) {
  return (
    <div
      role="region"
      aria-label="État vide"
      className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-12 text-center"
    >
      <div aria-hidden="true" className="text-4xl">
        📄
      </div>
      <h2 className="mt-3 text-base font-semibold text-stone-900">{title}</h2>
      <p className="mt-2 text-sm text-stone-600">{description}</p>
      {ctaHref && ctaLabel ? (
        <div className="mt-4">
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
          >
            {ctaLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
