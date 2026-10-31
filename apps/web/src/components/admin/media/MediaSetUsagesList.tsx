/**
 * Usages d'un média par les ensembles « médias par audience » (fiche média).
 *
 * `usages === null` : la lecture a échoué → « usages indisponibles » (et
 * surtout pas « aucun », qui laisserait croire le média libre). Les vivants
 * (publié, programmé, brouillon) sont listés, les archivés comptés à part :
 * ils bloquent quand même la suppression définitive (FK RESTRICT).
 */
import Link from 'next/link';
import {
  describeMediaSetUsage,
  mediaSetUsageHref,
  type MediaSetUsageLike,
} from '@/lib/media/media-set-usage';

export function MediaSetUsagesList({ usages }: { usages: MediaSetUsageLike[] | null }): JSX.Element {
  const live = usages?.filter((u) => u.status !== 'archived') ?? [];
  const archived = usages ? usages.length - live.length : 0;
  return (
    <>
      <h3
        id="set-usages-title"
        className="mt-5 text-xs font-semibold uppercase tracking-wide text-stone-500"
      >
        Médias par audience{usages ? ` (${live.length})` : ''}
      </h3>
      {usages === null ? (
        <p role="status" className="mt-2 text-sm text-amber-800">
          Usages indisponibles : la liste des ensembles n’a pas pu être lue. Réessayez avant toute
          suppression définitive.
        </p>
      ) : live.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">Utilisé par aucun ensemble de médias par audience.</p>
      ) : (
        <ul role="list" aria-labelledby="set-usages-title" className="mt-2 space-y-1 text-sm">
          {live.map((u) => {
            const href = mediaSetUsageHref(u);
            const label = describeMediaSetUsage(u);
            return (
              <li key={u.setId} className="text-stone-700">
                {href ? (
                  <Link href={href} className="hover:underline">
                    {label}
                  </Link>
                ) : (
                  label
                )}
              </li>
            );
          })}
        </ul>
      )}
      {archived > 0 ? (
        <p className="mt-2 text-xs text-stone-500">
          + {archived} version{archived > 1 ? 's' : ''} archivée{archived > 1 ? 's' : ''} (historique :
          empêche la suppression définitive).
        </p>
      ) : null}
    </>
  );
}
