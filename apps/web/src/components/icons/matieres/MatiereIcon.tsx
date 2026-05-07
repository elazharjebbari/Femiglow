import type { SVGProps } from 'react';

type Slug = 'cire' | 'jojoba' | 'kaolin' | 'mica';

interface MatiereIconProps extends SVGProps<SVGSVGElement> {
  slug: Slug;
}

export function MatiereIcon({ slug, ...props }: MatiereIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      role="presentation"
      {...props}
    >
      {slug === 'cire' ? <Cire /> : null}
      {slug === 'jojoba' ? <Jojoba /> : null}
      {slug === 'kaolin' ? <Kaolin /> : null}
      {slug === 'mica' ? <Mica /> : null}
    </svg>
  );
}

function Cire() {
  return (
    <g>
      <path d="M16 4 v6" />
      <path d="M16 10 c -5 0 -8 4 -8 9 a 8 8 0 0 0 16 0 c 0 -5 -3 -9 -8 -9 z" />
      <path d="M11 18 h10" />
      <path d="M12 22 h8" />
    </g>
  );
}

function Jojoba() {
  return (
    <g>
      <path d="M16 5 c 5 4 5 13 0 22 c -5 -9 -5 -18 0 -22 z" />
      <path d="M16 9 v18" />
    </g>
  );
}

function Kaolin() {
  return (
    <g>
      <path d="M6 22 l 6 -8 l 5 5 l 4 -6 l 5 9 z" />
      <path d="M5 26 h22" />
      <circle cx="12" cy="11" r="1.2" />
    </g>
  );
}

function Mica() {
  return (
    <g>
      <path d="M16 4 l 5 7 l -5 4 l -5 -4 z" />
      <path d="M16 15 l 7 5 l -3 7 h -8 l -3 -7 z" />
      <path d="M11 11 l 5 4 l 5 -4" />
    </g>
  );
}
