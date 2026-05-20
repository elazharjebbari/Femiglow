'use client';

import { useState } from 'react';
import type { ContentPost, ContentDraft } from '@/lib/content-studio/types';
import { SectionTitle } from './SectionTitle';
import { getJson } from './api';

export function UtmBuilder({
  post,
  draft,
}: {
  post: ContentPost;
  draft: ContentDraft | null;
}) {
  const [utm, setUtm] = useState<Record<string, string> | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    const value = await getJson<{ utm: Record<string, string> }>(
      `/api/admin/content-studio/utm?postId=${post.id}`,
    );
    setUtm(value.utm);
    setCopied(false);
  }

  function copyToClipboard() {
    if (!utm) return;
    const params = new URLSearchParams(
      Object.entries(utm).filter(([, v]) => v),
    ).toString();
    void navigator.clipboard.writeText(`?${params}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <SectionTitle
        eyebrow="Tracking"
        title="UTM"
        tone="stone"
        description="Générer et copier les paramètres UTM pour ce post."
      />
      {utm ? (
        <div className="mt-3 space-y-1">
          {Object.entries(utm).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="font-medium text-stone-600">{key}</span>
              <span className="text-stone-400">=</span>
              <span className="text-stone-900">{value || '—'}</span>
            </div>
          ))}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={copyToClipboard}
              className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              {copied ? 'Copié !' : 'Copier ?utm_…'}
            </button>
            <button
              type="button"
              onClick={generate}
              className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              Régénérer
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={generate}
          className="mt-2 rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white"
        >
          Générer les UTM
        </button>
      )}
      {draft && (
        <p className="mt-2 text-xs text-stone-500">
          Source : {draft.platform} · Medium : {draft.format}
        </p>
      )}
    </div>
  );
}