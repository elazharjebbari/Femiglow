import {
  LEAD_SOURCE_CHANNEL_LABELS,
  LEAD_SOURCE_KIND_LABELS,
  type LeadSource,
  type LeadSourceChannel,
  type LeadSourceKind,
} from '@/lib/leads/lead-source';

const CHANNEL_DOT: Record<LeadSourceChannel, string> = {
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-600',
  meta_other: 'bg-indigo-400',
  youtube: 'bg-red-600',
  google_search: 'bg-sky-500',
  google_other: 'bg-sky-300',
  tiktok: 'bg-stone-900',
  snapchat: 'bg-yellow-400',
  chatgpt: 'bg-teal-600',
  ai_other: 'bg-violet-500',
  pinterest: 'bg-rose-700',
  bing: 'bg-cyan-600',
  other_search: 'bg-cyan-300',
  whatsapp: 'bg-green-500',
  email: 'bg-amber-500',
  other_site: 'bg-stone-400',
  direct: 'bg-stone-500',
  unknown: 'bg-stone-300',
};

const KIND_PILL: Record<LeadSourceKind, string> = {
  paid: 'bg-amber-100 text-amber-900',
  organic: 'bg-emerald-100 text-emerald-900',
  ai: 'bg-violet-100 text-violet-900',
  direct: 'bg-stone-200 text-stone-800',
  unknown: 'border border-dashed border-stone-300 text-stone-600',
};

export function ChannelDot({ channel }: { channel: LeadSourceChannel }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${CHANNEL_DOT[channel]}`}
    />
  );
}

export function KindPill({ kind }: { kind: LeadSourceKind }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${KIND_PILL[kind]}`}>
      {LEAD_SOURCE_KIND_LABELS[kind]}
    </span>
  );
}

/** Colonne Source du tableau : canal, type, puis campagne ou site d'origine. */
export function LeadSourceBadge({ source }: { source: LeadSource }) {
  const detail = source.campaign ?? source.site;
  return (
    <div className="min-w-[11rem] space-y-1" data-testid="lead-source">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-stone-900">
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <ChannelDot channel={source.channel} />
          {LEAD_SOURCE_CHANNEL_LABELS[source.channel]}
        </span>
        <KindPill kind={source.kind} />
      </p>
      {detail ? (
        <p className="max-w-44 truncate text-xs text-stone-500" title={detail}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}
