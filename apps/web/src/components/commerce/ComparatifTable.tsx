import type { KitComparatif } from '@/lib/schemas';

interface ComparatifTableProps {
  data: KitComparatif;
  /** Phase 9bis — en-tête de colonne « Axe » localisé. Défaut FR. */
  axisLabel?: string;
}

export function ComparatifTable({ data, axisLabel = 'Axe' }: ComparatifTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-encre text-creme text-start">
          <tr>
            <th scope="col" className="p-4 font-medium uppercase tracking-[0.12em] text-[11px]">
              {axisLabel}
            </th>
            <th scope="col" className="p-4 font-display text-base normal-case tracking-normal">
              {data.titreVernis}
            </th>
            <th scope="col" className="p-4 font-display text-base normal-case tracking-normal">
              {data.titreRituel}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-encre/10 text-encre">
          {data.rows.map((row) => (
            <tr key={row.axis} className="align-top">
              <th
                scope="row"
                className="bg-creme-warm p-4 text-start font-display text-base text-encre"
              >
                {row.axis}
              </th>
              <td className="p-4 text-encre/80">{row.vernis}</td>
              <td className="bg-petale-soft/40 p-4 text-encre">{row.rituel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
