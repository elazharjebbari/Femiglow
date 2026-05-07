import type { CSSProperties } from 'react';

export interface MediaPlaceholderProps {
  width?: number;
  height?: number;
  fallback?: string;
  label?: string;
  ariaBusy?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function MediaPlaceholder({
  width = 1200,
  height = 800,
  fallback,
  label,
  ariaBusy,
  className,
  style,
}: MediaPlaceholderProps) {
  if (fallback) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fallback}
        width={width}
        height={height}
        alt={label ?? ''}
        aria-hidden={label ? undefined : true}
        aria-busy={ariaBusy}
        className={className}
        style={style}
      />
    );
  }
  const aspectRatio = `${width} / ${height}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label ?? 'image en cours de chargement'}
      aria-busy={ariaBusy}
      className={className}
      style={{ aspectRatio, width: '100%', height: 'auto', ...style }}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="100%" height="100%" fill="#f3ede4" />
      <g
        fill="none"
        stroke="#d6c0ac"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      >
        <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) / 6} />
        <path
          d={`M${width / 2 - 40} ${height / 2} q40 -40 80 0 q-40 40 -80 0 z`}
        />
      </g>
    </svg>
  );
}
