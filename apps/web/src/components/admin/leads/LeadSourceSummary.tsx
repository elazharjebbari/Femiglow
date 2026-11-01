import Link from 'next/link';

import type { LeadSourceCount, LeadSourceStats } from '@/lib/db/queries/leads';
import {
  LEAD_SOURCE_CHANNEL_LABELS,
  LEAD_SOURCE_KIND_LABELS,
  LEAD_SOURCE_KINDS,
  type LeadSourceChannel,
  type LeadSourceKind,
} from '@/lib/leads/lead-source';
import { leadsHref, type LeadsQuery } from '@/lib/leads/leads-url';

import { ChannelDot } from './LeadSourceBadge';

interface LeadSourceSummaryProps {
  stats: LeadSourceStats;
  query: LeadsQuery;
  channel?: LeadSourceChannel;
  kind?: LeadSourceKind;
}

function percent(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)} %` : '0 %';
}

/**
 * Vue d'ensemble au-dessus du tableau. Un clic filtre, un second clic retire le
 * filtre ; les chiffres restent ceux de la sélection de base, pour comparer.
 */
export function LeadSourceSummary({ stats, query, channel, kind }: LeadSourceSummaryProps) {
  const kindCounts = new Map(stats.kinds.map(({ key, ...count }) => [key, count]));
  const empty: LeadSourceCount = { leads: 0, purchases: 0 };

  return (
    <section aria-label="Répartition par source" className="mb-6 space-y-3" data-testid="lead-source-summary">
      <ul className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {LEAD_SOURCE_KINDS.map((key) => {
          const count = kindCounts.get(key) ?? empty;
          const active = kind === key;
          return (
            <li key={key}>
              <Link
                href={leadsHref(query, { kind: active ? undefined : key })}
                aria-current={active ? 'true' : undefined}
                data-testid={`lead-kind-${key}`}
                className={`block rounded-md border px-3 py-2 transition-colors ${
                  active
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 bg-white hover:border-stone-400'
                }`}
              >
                <span className={`block text-xs ${active ? 'text-stone-300' : 'text-stone-600'}`}>
                  {LEAD_SOURCE_KIND_LABELS[key]}
                </span>
                <span className="mt-0.5 block text-xl font-semibold tabular-nums">{count.leads}</span>
                <span className={`block text-xs ${active ? 'text-stone-300' : 'text-stone-600'}`}>
                  {percent(count.leads, stats.total)} · {count.purchases} achat
                  {count.purchases > 1 ? 's' : ''}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <ul className="flex flex-wrap gap-2">
        {stats.channels.map(({ key, leads, purchases }) => {
          const active = channel === key;
          return (
            <li key={key}>
              <Link
                href={leadsHref(query, { channel: active ? undefined : key })}
                aria-current={active ? 'true' : undefined}
                data-testid={`lead-channel-${key}`}
                title={`${purchases} achat${purchases > 1 ? 's' : ''} sur ${leads} lead${leads > 1 ? 's' : ''}`}
                className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors ${
                  active
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 bg-white text-stone-800 hover:border-stone-400'
                }`}
              >
                <ChannelDot channel={key} />
                {LEAD_SOURCE_CHANNEL_LABELS[key]}
                <span className="font-semibold tabular-nums">{leads}</span>
                <span className={`text-xs ${active ? 'text-stone-300' : 'text-stone-600'}`}>
                  {percent(purchases, leads)} d’achat
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
