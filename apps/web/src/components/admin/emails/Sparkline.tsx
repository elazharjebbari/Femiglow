/**
 * Sparkline — mini-courbe SVG décorative des cartes KPI (F03, DASH-06).
 *
 * Strictement décorative : `aria-hidden`, la donnée chiffrée vit dans la carte
 * (tendance + valeur) — jamais d'information portée par la courbe seule.
 */
export function Sparkline({
  points,
  className = '',
  stroke = 'currentColor',
}: {
  /** 12 valeurs (index 0 = plus ancien). */
  points: number[];
  className?: string;
  stroke?: string;
}) {
  if (points.length < 2) return null;
  const W = 72;
  const H = 20;
  const max = Math.max(...points, 1);
  const step = W / (points.length - 1);
  const path = points
    .map((v, i) => `${Math.round(i * step)},${H - Math.round((v / max) * (H - 2)) - 1}`)
    .join(' ');
  return (
    <svg
      aria-hidden="true"
      data-testid="kpi-sparkline"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className={className}
    >
      <polyline points={path} fill="none" stroke={stroke} strokeWidth="1.5" opacity="0.55" />
    </svg>
  );
}
