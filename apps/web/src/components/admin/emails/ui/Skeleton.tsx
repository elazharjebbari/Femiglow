/**
 * Skeleton — états de chargement DESSINÉS du socle emails (charte 09 §A.3).
 *
 * Remplace le spinner générique sur les listes : un squelette structurel
 * (colonnes/cartes fantômes) qui préserve la mise en page. `role="status"` +
 * libellé `sr-only` pour les lecteurs d'écran ; le visuel est `aria-hidden`.
 * Pulsation `motion-safe` (prefers-reduced-motion respecté).
 */
import { RADIUS } from './tokens';

const BAR = 'motion-safe:animate-pulse rounded bg-stone-200';

export function Skeleton({
  label = 'Chargement…',
  className = '',
  children,
}: {
  label?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

/** Squelette de table : `rows` lignes × `cols` colonnes fantômes. */
export function SkeletonTable({
  rows = 5,
  cols = 4,
  label = 'Chargement de la liste…',
}: {
  rows?: number;
  cols?: number;
  label?: string;
}) {
  return (
    <Skeleton label={label}>
      <div className={`overflow-hidden ${RADIUS.card} border border-stone-200`}>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 border-b border-stone-100 px-3 py-2 last:border-0">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className={`h-3 ${BAR}`} style={{ width: `${100 / cols}%` }} />
            ))}
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

/** Squelette de carte KPI : titre court + grand chiffre fantômes. */
export function SkeletonKpiCard({ label = 'Chargement de l’indicateur…' }: { label?: string }) {
  return (
    <Skeleton label={label}>
      <div className={`${RADIUS.card} border border-stone-200 bg-white p-4`}>
        <div className={`h-3 w-24 ${BAR}`} />
        <div className={`mt-3 h-7 w-16 ${BAR}`} />
      </div>
    </Skeleton>
  );
}
