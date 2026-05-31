import Link from 'next/link';

import { listPlacementsForZone } from '@/lib/legal/repository';

interface Props {
  currentSlug: string;
  /** Max # de liens à afficher (excluant currentSlug). Défaut : 4. */
  limit?: number;
}

/**
 * "Voir aussi" — affiche les autres pages légales placées dans la zone
 * `footer-main` (la plus exhaustive), exclut la slug courante, limite à
 * 4 par défaut. Rendu côté serveur, fallback gracieux si DB indispo.
 */
export async function LegalRelatedLinks({ currentSlug, limit = 4 }: Props) {
  let rows: Array<{ pageSlug: string; title: string; labelOverride: string | null }> = [];
  try {
    const placements = await listPlacementsForZone('footer-main');
    rows = placements.filter((p) => p.pageSlug !== currentSlug).slice(0, limit);
  } catch {
    rows = [];
  }

  if (rows.length === 0) return null;

  return (
    <nav aria-labelledby="related-title" className="mt-12 border-t border-encre/10 pt-8">
      <h2
        id="related-title"
        className="text-xs uppercase tracking-wider text-encre/50"
      >
        Voir aussi
      </h2>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.pageSlug}>
            <Link
              href={`/legal/${r.pageSlug}`}
              className="inline-flex items-center gap-2 text-sm text-encre underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-encre"
            >
              <span aria-hidden="true">→</span>
              {r.labelOverride ?? r.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
