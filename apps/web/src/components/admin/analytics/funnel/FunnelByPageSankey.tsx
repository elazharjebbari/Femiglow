/**
 * FunnelByPageSankey — flux first_page → max stage atteint.
 * cf. docs/analytics/05-onglets-specs.md §3.5
 *
 * Implémentation : on ne tire pas Recharts <Sankey> — il alourdit le bundle et
 * son rendu n'est pas particulièrement lisible avec 20 sources. À la place, une
 * vue tabulaire stacked-bar : 1 ligne par page, avec une barre composée des
 * volumes par stage atteint (palette sauge → ciel → champagne → pétale).
 *
 * `truncated=true` → on rend une dernière ligne "Autres" avec la palette
 * dégradée pour signaler le bucket résiduel.
 */
import type {
  FunnelSankeyLink,
  FunnelStage,
} from '@/lib/analytics/queries/funnel';
import { formatNumber, formatPercent } from '@/lib/analytics/format';

import { ChartFrame } from '../primitives/ChartFrame';

const STAGE_ORDER: FunnelStage[] = ['view', 'engage', 'cta', 'checkout', 'purchase'];

const STAGE_LABELS: Record<FunnelStage, string> = {
  view: 'View',
  engage: 'Engage',
  cta: 'CTA',
  checkout: 'Checkout',
  purchase: 'Purchase',
};

const STAGE_COLORS: Record<FunnelStage, string> = {
  view: 'bg-stone-300',
  engage: 'bg-emerald-300',
  cta: 'bg-sky-300',
  checkout: 'bg-amber-300',
  purchase: 'bg-rose-300',
};

interface FunnelByPageSankeyProps {
  links: FunnelSankeyLink[];
  truncated: boolean;
  loading?: boolean;
}

export function FunnelByPageSankey({
  links,
  truncated,
  loading = false,
}: FunnelByPageSankeyProps) {
  // Regroupe par firstPage → totaux par stage
  const byPage = new Map<string, { stages: Record<FunnelStage, number>; total: number }>();
  for (const l of links) {
    const acc =
      byPage.get(l.firstPage) ??
      ({
        stages: { view: 0, engage: 0, cta: 0, checkout: 0, purchase: 0 },
        total: 0,
      } satisfies { stages: Record<FunnelStage, number>; total: number });
    acc.stages[l.reachedStage] += l.volume;
    acc.total += l.volume;
    byPage.set(l.firstPage, acc);
  }

  // Trie : "Autres" toujours en dernier ; sinon par volume desc.
  const rows = Array.from(byPage.entries()).sort((a, b) => {
    if (a[0] === 'Autres') return 1;
    if (b[0] === 'Autres') return -1;
    return b[1].total - a[1].total;
  });

  const isEmpty = rows.length === 0;

  return (
    <ChartFrame
      title="Flux par page d'entrée"
      description={
        truncated
          ? 'Top 20 pages affichées. Les autres pages sont agrégées sous « Autres ».'
          : 'Chaque ligne représente une page d\u2019entrée et la répartition des sessions par étape MAX atteinte.'
      }
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="Pas de session avec une étape funnel atteignable."
      height={Math.max(180, Math.min(560, rows.length * 32 + 40))}
    >
      <div data-testid="funnel-sankey" className="flex h-full flex-col gap-2 overflow-y-auto pr-1">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-stone-400">
          {STAGE_ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`inline-block h-2 w-2 rounded-sm ${STAGE_COLORS[s]}`} aria-hidden="true" />
              {STAGE_LABELS[s]}
            </span>
          ))}
        </div>
        {rows.map(([page, info]) => (
          <div key={page} className="flex items-center gap-3 text-sm">
            <span
              className="w-40 shrink-0 truncate font-mono text-xs text-stone-700"
              title={page}
            >
              {page}
            </span>
            <div className="relative flex h-5 flex-1 overflow-hidden rounded-full bg-stone-50">
              {STAGE_ORDER.map((stage) => {
                const v = info.stages[stage];
                if (v <= 0 || info.total === 0) return null;
                const width = (v / info.total) * 100;
                return (
                  <div
                    key={stage}
                    className={`${STAGE_COLORS[stage]} flex items-center justify-center text-[10px] text-stone-900`}
                    style={{ width: `${width}%` }}
                    title={`${STAGE_LABELS[stage]} · ${formatNumber(v)} (${formatPercent(v / info.total, 0)})`}
                  >
                    {width >= 14 ? formatNumber(v) : ''}
                  </div>
                );
              })}
            </div>
            <span className="w-16 shrink-0 text-right tabular-nums text-stone-500">
              {formatNumber(info.total)}
            </span>
          </div>
        ))}
      </div>
    </ChartFrame>
  );
}
