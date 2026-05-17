'use client';

import { useMemo, type Dispatch, type SetStateAction } from 'react';
import type {
  ContentDraft,
  ContentPost,
  ContentPostizDelivery,
  ContentPerformanceSnapshot,
} from '@/lib/content-studio/types';
import type { AutomationResponse, RunFunction } from './types';
import { SectionTitle } from './SectionTitle';
import { DeliveryStatusBadge } from './DeliveryStatusBadge';
import { postJson } from './api';
import { summarizeSnapshot, formatShortDate } from './helpers';

export function PostizHealthPanel({
  posts,
  drafts,
  deliveries,
  snapshots,
  disabled,
  setDeliveries,
  setSnapshots,
  run,
  setMessage,
}: {
  posts: ContentPost[];
  drafts: ContentDraft[];
  deliveries: ContentPostizDelivery[];
  snapshots: ContentPerformanceSnapshot[];
  disabled: boolean;
  setDeliveries: Dispatch<SetStateAction<ContentPostizDelivery[]>>;
  setSnapshots: Dispatch<SetStateAction<ContentPerformanceSnapshot[]>>;
  run: RunFunction;
  setMessage: (message: string | null) => void;
}) {
  const counts = useMemo(
    () => ({
      sent: deliveries.filter((delivery) => delivery.status === 'sent').length,
      failed: deliveries.filter((delivery) => delivery.status === 'failed').length,
      authFailed: deliveries.filter((delivery) => delivery.status === 'auth_failed').length,
      statusSnapshots: snapshots.filter((snapshot) => snapshot.source === 'postiz_status').length,
      analyticsSnapshots: snapshots.filter((snapshot) => snapshot.source === 'postiz_analytics').length,
    }),
    [deliveries, snapshots],
  );
  const latestDeliveries = deliveries.slice(0, 6);
  const latestSnapshots = snapshots.slice(0, 4);

  function runAutomation(
    job: AutomationResponse['job'],
    input: Record<string, unknown>,
    successMessage: string,
  ) {
    run(
      async () =>
        postJson<AutomationResponse>('/api/admin/content-studio/automation', {
          job,
          ...input,
        }),
      (value) => {
        if (value.deliveries) setDeliveries(value.deliveries);
        if (value.snapshots) setSnapshots(value.snapshots);
        setMessage(successMessage);
      },
    );
  }

  return (
    <section className="rounded-md border border-indigo-100 bg-indigo-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionTitle
          eyebrow="Ops Postiz"
          title="Santé publication"
          tone="indigo"
          description="Contrôler les livraisons, les retries et les imports sans quitter le studio."
        />
        <div className="grid grid-cols-2 gap-2 text-center text-xs md:grid-cols-5">
          <OpsMetric label="Envoyés" value={counts.sent} tone="emerald" />
          <OpsMetric label="Échecs" value={counts.failed} tone="red" />
          <OpsMetric label="Auth" value={counts.authFailed} tone="amber" />
          <OpsMetric label="Statuts" value={counts.statusSnapshots} tone="indigo" />
          <OpsMetric label="Analytics" value={counts.analyticsSnapshots} tone="sky" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            runAutomation(
              'retry-deliveries',
              { dryRun: true, limit: 5, maxAttempts: 3 },
              'Dry-run retry Postiz terminé.',
            )
          }
          className="rounded-md border border-indigo-200 bg-white px-3 py-2 text-xs font-medium text-indigo-950 disabled:opacity-50"
        >
          Tester retries
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            runAutomation(
              'import-status',
              { dryRun: false, limit: 20, pastDays: 30, futureDays: 30 },
              'Import des statuts Postiz terminé.',
            )
          }
          className="rounded-md border border-indigo-200 bg-white px-3 py-2 text-xs font-medium text-indigo-950 disabled:opacity-50"
        >
          Importer statuts
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            runAutomation(
              'import-performance',
              { dryRun: false, limit: 5, days: 7 },
              'Import des performances Postiz terminé.',
            )
          }
          className="rounded-md border border-indigo-200 bg-white px-3 py-2 text-xs font-medium text-indigo-950 disabled:opacity-50"
        >
          Importer analytics
        </button>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded border border-indigo-100 bg-white">
          <div className="grid grid-cols-[92px_1fr_120px_120px] border-b border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-950">
            <span>Statut</span>
            <span>Post</span>
            <span>Postiz</span>
            <span>Date</span>
          </div>
          {latestDeliveries.length === 0 ? (
            <p className="px-3 py-4 text-sm text-stone-500">Aucune livraison Postiz enregistrée.</p>
          ) : (
            latestDeliveries.map((delivery) => {
              const post = posts.find((item) => item.id === delivery.postId);
              const draft = post ? drafts.find((item) => item.id === post.draftId) : null;
              return (
                <div
                  key={delivery.id}
                  className="grid grid-cols-[92px_1fr_120px_120px] gap-2 border-b border-stone-100 px-3 py-2 text-xs last:border-b-0"
                >
                  <DeliveryStatusBadge status={delivery.status} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-stone-900">
                      {draft?.hook ?? draft?.variantLabel ?? delivery.postId}
                    </span>
                    {delivery.lastError ? (
                      <span className="block truncate text-red-700">{delivery.lastError}</span>
                    ) : null}
                  </span>
                  <span className="truncate text-stone-500">{delivery.postizPostId ?? 'non lié'}</span>
                  <span className="text-stone-500">{formatShortDate(delivery.createdAt)}</span>
                </div>
              );
            })
          )}
        </div>

        <div className="rounded border border-indigo-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Snapshots récents
          </p>
          <ul className="mt-2 space-y-2">
            {latestSnapshots.length === 0 ? (
              <li className="text-sm text-stone-500">Aucun statut ou analytics importé.</li>
            ) : (
              latestSnapshots.map((snapshot) => (
                <li key={snapshot.id} className="rounded border border-stone-100 px-2 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-stone-900">{snapshot.source}</span>
                    <span className="text-stone-500">{formatShortDate(snapshot.capturedAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-stone-500">
                    {summarizeSnapshot(snapshot)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

function OpsMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'red' | 'amber' | 'indigo' | 'sky';
}) {
  const cls = {
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-950',
    red: 'border-red-100 bg-red-50 text-red-950',
    amber: 'border-amber-100 bg-amber-50 text-amber-950',
    indigo: 'border-indigo-100 bg-white text-indigo-950',
    sky: 'border-sky-100 bg-sky-50 text-sky-950',
  }[tone];
  return (
    <div className={`rounded border px-3 py-2 ${cls}`}>
      <p className="text-base font-semibold">{value}</p>
      <p className="text-[11px] opacity-80">{label}</p>
    </div>
  );
}