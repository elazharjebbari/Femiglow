interface FootnoteProps {
  n: number;
}

export function Footnote({ n }: FootnoteProps) {
  return (
    <sup id={`fn-${n}`} className="ml-0.5 text-[0.7em] font-body">
      <a
        href={`#src-${n}`}
        aria-describedby={`src-${n}`}
        className="text-encre/70 underline-offset-2 hover:underline focus-visible:underline"
      >
        {n}
      </a>
    </sup>
  );
}

interface SourcesListProps {
  sources: string[];
  className?: string;
}

export function SourcesList({ sources, className }: SourcesListProps) {
  return (
    <ol
      className={`mt-12 list-decimal space-y-2 pl-6 text-sm leading-relaxed text-encre/70 ${className ?? ''}`}
    >
      {sources.map((source, i) => (
        <li key={i} id={`src-${i + 1}`}>
          {source}{' '}
          <a
            href={`#fn-${i + 1}`}
            aria-label={`Retour à l\u2019appel de note ${i + 1}`}
            className="ml-1 inline-block underline-offset-2 hover:underline focus-visible:underline"
          >
            ↩
          </a>
        </li>
      ))}
    </ol>
  );
}
