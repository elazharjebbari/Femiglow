'use client';

function SectionTitle({
  eyebrow,
  title,
  description,
  tone,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  tone: 'rose' | 'sky' | 'amber' | 'violet' | 'teal' | 'indigo';
}) {
  const toneClass = {
    rose: 'text-rose-700',
    sky: 'text-sky-700',
    amber: 'text-amber-700',
    violet: 'text-violet-700',
    teal: 'text-teal-700',
    indigo: 'text-indigo-700',
  }[tone];
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide ${toneClass}`}>{eyebrow}</p>
      <h2 className="mt-0.5 text-sm font-semibold text-stone-900">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-stone-500">{description}</p> : null}
    </div>
  );
}

export { SectionTitle };