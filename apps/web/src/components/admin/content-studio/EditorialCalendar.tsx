'use client';

import type { ContentDraft, ContentPost, ContentPostizDelivery } from '@/lib/content-studio/types';
import { SectionTitle } from './SectionTitle';
import { DeliveryStatusBadge } from './DeliveryStatusBadge';
import { formatShortDate } from './helpers';

export function EditorialCalendar({
  posts,
  drafts,
  deliveries,
}: {
  posts: ContentPost[];
  drafts: ContentDraft[];
  deliveries: ContentPostizDelivery[];
}) {
  const items = posts
    .map((post) => {
      const draft = drafts.find((item) => item.id === post.draftId);
      const latestDelivery = deliveries.find((delivery) => delivery.postId === post.id) ?? null;
      return { post, draft, latestDelivery };
    })
    .sort((a, b) => {
      const aTime = new Date(a.post.scheduledAt ?? a.post.createdAt).getTime();
      const bTime = new Date(b.post.scheduledAt ?? b.post.createdAt).getTime();
      return bTime - aTime;
    })
    .slice(0, 8);

  return (
    <section className="rounded-md border border-teal-100 bg-teal-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionTitle
          eyebrow="Calendrier"
          title="Pipeline éditorial"
          tone="teal"
          description="Suivre les posts validés, datés et envoyés à Postiz."
        />
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <Metric label="Approuvés" value={posts.filter((post) => post.status === 'approved').length} />
          <Metric label="Datés" value={posts.filter((post) => post.scheduledAt).length} />
          <Metric label="Postiz" value={deliveries.filter((delivery) => delivery.status === 'sent').length} />
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {items.length === 0 ? (
          <p className="text-sm text-stone-500">Aucun post approuvé pour le moment.</p>
        ) : (
          items.map(({ post, draft, latestDelivery }) => (
            <article key={post.id} className="rounded border border-teal-100 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800">
                  {post.scheduledAt ? formatShortDate(post.scheduledAt) : 'Sans date'}
                </span>
                <DeliveryStatusBadge status={latestDelivery?.status ?? 'pending'} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium text-stone-900">
                {draft?.hook ?? draft?.variantLabel ?? post.id}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                {draft?.platform ?? 'social'} · {draft?.format ?? 'post'} · {post.status}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-teal-100 bg-white px-3 py-2">
      <p className="text-base font-semibold text-teal-950">{value}</p>
      <p className="text-[11px] text-teal-800">{label}</p>
    </div>
  );
}