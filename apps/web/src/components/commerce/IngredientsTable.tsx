import type { SubProduct } from '@/lib/schemas';

interface IngredientsTableProps {
  subProduct: SubProduct;
}

export function IngredientsTable({ subProduct }: IngredientsTableProps) {
  return (
    <figure className="my-10">
      <figcaption className="mb-4 font-display text-2xl text-encre">
        {subProduct.name} — {subProduct.volume}
      </figcaption>
      <div
        role="region"
        aria-label={`Composition de ${subProduct.name}`}
        tabIndex={0}
        className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-encre"
      >
        <table className="w-full border-collapse text-sm">
          <thead className="bg-sauge-soft text-left text-[11px] uppercase tracking-[0.12em] text-encre/70">
            <tr>
              <th scope="col" className="p-3 font-medium">Ingrédient</th>
              <th scope="col" className="p-3 font-medium">INCI</th>
              <th scope="col" className="p-3 font-medium">Fonction</th>
              <th scope="col" className="p-3 font-medium">Origine</th>
              <th scope="col" className="p-3 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-encre/10 text-encre">
            {subProduct.ingredients.map((ing) => (
              <tr key={`${subProduct.id}-${ing.inci}`}>
                <th scope="row" className="p-3 text-left font-medium">
                  {ing.name}
                </th>
                <td className="p-3 text-encre/70">{ing.inci}</td>
                <td className="p-3">{ing.function}</td>
                <td className="p-3">{ing.origin}</td>
                <td className="p-3 text-right [font-feature-settings:'tnum','lnum']">
                  {ing.concentrationPct !== undefined ? `${ing.concentrationPct}\u202f%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {subProduct.certifications.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Certifications">
          {subProduct.certifications.map((cert) => (
            <li
              key={`${subProduct.id}-${cert.label}`}
              className="rounded-full border border-champagne-dark/40 bg-champagne-soft px-3 py-1 text-xs text-encre/80"
            >
              {cert.label} — {cert.body}
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}
