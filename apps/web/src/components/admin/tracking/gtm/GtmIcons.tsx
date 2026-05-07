/**
 * Icônes SVG inline — pas de dépendance externe.
 * Conventions : 16×16 viewBox, stroke-current, pour s'adapter
 * à la couleur du parent.
 */

interface IconProps {
  className?: string;
  'aria-hidden'?: boolean;
}

const baseProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconDownload({ className, ...rest }: IconProps) {
  return (
    <svg className={className} aria-hidden={rest['aria-hidden'] ?? true} {...baseProps}>
      <path d="M8 2v8" />
      <path d="m4.5 7 3.5 3.5L11.5 7" />
      <path d="M2.5 13h11" />
    </svg>
  );
}

export function IconCopy({ className, ...rest }: IconProps) {
  return (
    <svg className={className} aria-hidden={rest['aria-hidden'] ?? true} {...baseProps}>
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
    </svg>
  );
}

export function IconCheck({ className, ...rest }: IconProps) {
  return (
    <svg className={className} aria-hidden={rest['aria-hidden'] ?? true} {...baseProps}>
      <path d="m3 8.5 3.2 3L13 4.5" />
    </svg>
  );
}

export function IconAlert({ className, ...rest }: IconProps) {
  return (
    <svg className={className} aria-hidden={rest['aria-hidden'] ?? true} {...baseProps}>
      <path d="M8 1.5 14.5 13.5h-13L8 1.5Z" />
      <path d="M8 6.5v3.5" />
      <circle cx="8" cy="11.75" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconExpand({ className, ...rest }: IconProps) {
  return (
    <svg className={className} aria-hidden={rest['aria-hidden'] ?? true} {...baseProps}>
      <path d="M2.5 6V2.5H6" />
      <path d="M14 6V2.5H10.5" />
      <path d="M2.5 10v3.5H6" />
      <path d="M14 10v3.5H10.5" />
    </svg>
  );
}

export function IconClose({ className, ...rest }: IconProps) {
  return (
    <svg className={className} aria-hidden={rest['aria-hidden'] ?? true} {...baseProps}>
      <path d="m3.5 3.5 9 9" />
      <path d="m12.5 3.5-9 9" />
    </svg>
  );
}
