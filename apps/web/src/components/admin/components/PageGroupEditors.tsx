/**
 * Éditeurs contextuels par groupe de page (admin/components?group=…).
 *
 * Certaines sections d'une page ont un éditeur dédié (singleton ou par
 * sous-entité) plutôt qu'un simple binding de composant — ex. la page `/kit`
 * a des éditeurs Vidéo / Composition / Pack. Au lieu de les exposer comme
 * entrées de nav globales (qui encombraient la sidebar), on les surface ICI,
 * en contexte, au-dessus de la liste des composants du groupe.
 *
 * Data-driven : ajouter un groupe = ajouter une entrée dans `GROUP_EDITORS`.
 */
import Link from 'next/link';

interface GroupEditor {
  label: string;
  href: string;
  description: string;
}

/** Éditeurs dédiés par `page_group`. Vide → rien n'est rendu. */
const GROUP_EDITORS: Record<string, GroupEditor[]> = {
  kit: [
    {
      label: 'Vidéo',
      href: '/admin/kit/video',
      description: 'Section « Les gestes » : URL YouTube, provenance, légende.',
    },
    {
      label: 'Composition',
      href: '/admin/kit/composition',
      description: 'Par sous-produit (paste · powder · polissoir) — cascade override.',
    },
    {
      label: 'Pack',
      href: '/admin/kit/pack',
      description: 'Section « Le Pack » (Kolenda §4.6) : pricing, packshot, arguments.',
    },
  ],
};

export function PageGroupEditors({ group }: { group?: string }) {
  const editors = group ? GROUP_EDITORS[group] : undefined;
  if (!editors || editors.length === 0) return null;

  return (
    <section className="mb-6" aria-label={`Éditeurs de sections /${group}`}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
        Éditeurs de sections /{group}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {editors.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className="group flex flex-col rounded-lg border border-stone-200 bg-white p-4 transition hover:border-stone-400 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-stone-900">{e.label}</span>
              <span
                aria-hidden
                className="text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-700"
              >
                →
              </span>
            </span>
            <span className="mt-1 text-xs leading-relaxed text-stone-500">
              {e.description}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
