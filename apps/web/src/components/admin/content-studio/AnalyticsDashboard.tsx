'use client';

import { useMemo } from 'react';
import type { ContentDraft, ContentPost, ContentPerformanceSnapshot } from '@/lib/content-studio/types';
import { SectionTitle } from './SectionTitle';
import { formatShortDate } from './helpers';

export function AnalyticsDashboard({
  posts,
  drafts,
  snapshots,
}: {
  posts: ContentPost[];
  drafts: ContentDraft[];
  snapshots: ContentPerformanceSnapshot[];
}) {
  const postsWithSnapshots = useMemo(() => {
    return posts
      .filter((post) => post.status === 'published' || post.status === 'scheduled' || post.status === 'measured')
      .map((post) => {
        const draft = drafts.find((d) => d.id === post.draftId);
        const postSnapshots = snapshots.filter((s) => s.postId === post.id);
        return { post, draft, postSnapshots };
      });
  }, [posts, drafts, snapshots]);

  const totals = useMemo(() => {
    let impressions = 0;
    let engagements = 0;
    let clicks = 0;
    for (const snapshot of snapshots) {
      const m = snapshot.metrics;
      if (typeof m.impressions === 'number') impressions += m.impressions;
      if (typeof m.reach === 'number') impressions += m.reach;
      if (typeof m.likes === 'number') engagements += m.likes;
      if (typeof m.comments === 'number') engagements += m.comments;
      if (typeof m.shares === 'number') engagements += m.shares;
      if (typeof m.saves === 'number') engagements += m.saves;
      if (typeof m.clicks === 'number') clicks += m.clicks;
      if (typeof m.linkClicks === 'number') clicks += m.linkClicks;
    }
    return { impressions, engagements, clicks };
  }, [snapshots]);

  return (
    <section className="rounded-md border border-emerald-100 bg-emerald-50/40 p-4">
      <SectionTitle
        eyebrow="Analytics"
        title="Tableau de bord"
        tone="teal"
        description="Vue d'ensemble des performances post-publication."
      />
      <div className="mt-4 grid grid-cols-3 gap-3">
        <MetricCard label="Impressions" value={totals.impressions} tone="sky" />
        <MetricCard label="Engagements" value={totals.engagements} tone="amber" />
        <MetricCard label="Clics" value={totals.clicks} tone="violet" />
      </div>
      <div className="mt-4 overflow-hidden rounded border border-stone-200 bg-white">
        <div className="grid grid-cols-[1fr_80px_80px_80px_100px] border-b border-stone-200 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-600">
          <span>Post</span>
          <span className="text-center">Impress.</span>
          <span className="text-center">Engage.</span>
          <span className="text-center">Clics</span>
          <span className="text-right">Statut</span>
        </div>
        {postsWithSnapshots.length === 0 ? (
          <p className="px-3 py-4 text-sm text-stone-500">Aucune donnée de performance disponible.</p>
        ) : (
          postsWithSnapshots.map(({ post, draft, postSnapshots }) => {
            const agg = aggregateMetrics(postSnapshots);
            return (
              <div
                key={post.id}
                className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-2 border-b border-stone-100 px-3 py-2 text-xs last:border-b-0"
              >
                <span className="min-w-0 truncate font-medium text-stone-900">
                  {draft?.hook ?? draft?.variantLabel ?? post.id.slice(0, 8)}
                </span>
                <span className="text-center text-stone-700">{agg.impressions || '—'}</span>
                <span className="text-center text-stone-700">{agg.engagements || '—'}</span>
                <span className="text-center text-stone-700">{agg.clicks || '—'}</span>
                <span className="text-right">
                  <StatusBadge status={post.status} />
                </span>
              </div>
            );
          })
        )}
      </div>
      {snapshots.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-stone-500">
            Dernier snapshot : {formatShortDate(snapshots[0]!.capturedAt)} · {snapshots.length} snapshot(s) au total
          </p>
        </div>
      )}
    </section>
  );
}

function aggregateMetrics(snapshots: ContentPerformanceSnapshot[]) {
  let impressions = 0;
  let engagements = 0;
  let clicks = 0;
  for (const s of snapshots) {
    const m = s.metrics;
    if (typeof m.impressions === 'number') impressions += m.impressions;
    if (typeof m.reach === 'number') impressions = Math.max(impressions, m.reach as number);
    if (typeof m.likes === 'number') engagements += m.likes;
    if (typeof m.comments === 'number') engagements += m.comments;
    if (typeof m.shares === 'number') engagements += m.shares;
    if (typeof m.saves === 'number') engagements += m.saves;
    if (typeof m.clicks === 'number') clicks += m.clicks;
    if (typeof m.linkClicks === 'number') clicks += m.linkClicks;
  }
  return { impressions, engagements, clicks };
}

function StatusBadge({ status }: { status: string }) {
  const color: Record<string, string> = {
    published: 'bg-emerald-50 text-emerald-800',
    scheduled: 'bg-sky-50 text-sky-800',
    measured: 'bg-teal-50 text-teal-800',
    failed: 'bg-red-50 text-red-800',
    cancelled: 'bg-stone-50 text-stone-600',
  };
  const cls = color[status] ?? 'bg-stone-50 text-stone-600';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {status}
    </span>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: 'sky' | 'amber' | 'violet' }) {
  const cls = {
    sky: 'border-sky-100 bg-sky-50 text-sky-950',
    amber: 'border-amber-100 bg-amber-50 text-amber-950',
    violet: 'border-violet-100 bg-violet-50 text-violet-950',
  }[tone];
  return (
    <div className={`rounded border px-4 py-3 ${cls}`}>
      <p className="text-2xl font-bold">{value.toLocaleString('fr-FR')}</p>
      <p className="text-xs opacity-75">{label}</p>
    </div>
  );
}