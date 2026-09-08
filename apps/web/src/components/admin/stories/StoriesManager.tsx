'use client';

import { useCallback, useState } from 'react';

export interface AdminSegment {
  id: string;
  storyId: string;
  videoUrl: string;
  webmUrl: string | null;
  posterUrl: string;
  durationMs: number;
  width: number | null;
  height: number | null;
  captionI18n: Record<string, string>;
  ctaLabelI18n: Record<string, string>;
  ctaTarget: string | null;
  displayOrder: number;
  isActive: boolean;
}
export interface AdminStory {
  id: string;
  slug: string;
  pageGroup: string;
  titleI18n: Record<string, string>;
  bubblePosterUrl: string;
  accent: string | null;
  displayOrder: number;
  isActive: boolean;
  segments: AdminSegment[];
}
export interface StoryMetrics {
  opens: number;
  views: number;
  completes: number;
  ctaClicks: number;
  completionRate: number | null;
  ctr: number | null;
}

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

const inputCls = 'mt-1 w-full rounded border border-stone-300 px-2 py-1 text-sm';
const btn = 'rounded px-2.5 py-1 text-xs font-medium disabled:opacity-50';

async function api(url: string, method: string, body?: unknown): Promise<Response> {
  return fetch(url, {
    method,
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function StoriesManager({
  initialStories,
  metricsByStory = {},
  totals,
}: {
  initialStories: AdminStory[];
  metricsByStory?: Record<string, StoryMetrics>;
  totals?: StoryMetrics;
}) {
  const [stories, setStories] = useState<AdminStory[]>(initialStories);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // formulaire nouvelle story
  const [nSlug, setNSlug] = useState('');
  const [nTitle, setNTitle] = useState('');
  const [nPoster, setNPoster] = useState('');

  const refresh = useCallback(async () => {
    const res = await api('/api/admin/stories', 'GET');
    if (res.ok) {
      const data = (await res.json()) as { items: AdminStory[] };
      setStories(data.items);
    }
  }, []);

  const run = useCallback(
    async (fn: () => Promise<Response>) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fn();
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          setError(b?.error?.message ?? `Erreur ${res.status}`);
          return false;
        }
        await refresh();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const createStory = () =>
    run(() =>
      api('/api/admin/stories', 'POST', {
        slug: nSlug.trim(),
        titleI18n: { fr: nTitle.trim() },
        bubblePosterUrl: nPoster.trim(),
        displayOrder: stories.length,
      }),
    ).then((ok) => {
      if (ok) {
        setNSlug('');
        setNTitle('');
        setNPoster('');
      }
    });

  const patchStory = (id: string, patch: Partial<AdminStory>) =>
    run(() => api(`/api/admin/stories/${id}`, 'PATCH', patch));
  const deleteStory = (id: string) => run(() => api(`/api/admin/stories/${id}`, 'DELETE'));
  const moveStory = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= stories.length) return;
    const a = stories[i]!;
    const b = stories[j]!;
    void run(async () => {
      await api(`/api/admin/stories/${a.id}`, 'PATCH', { displayOrder: b.displayOrder });
      return api(`/api/admin/stories/${b.id}`, 'PATCH', { displayOrder: a.displayOrder });
    });
  };

  const addSegment = (storyId: string, order: number) =>
    run(() =>
      api(`/api/admin/stories/${storyId}/segments`, 'POST', {
        videoUrl: '/stories/1.mp4',
        posterUrl: '/stories/1.jpg',
        durationMs: 0,
        ctaLabelI18n: { fr: 'Commander le pack' },
        ctaTarget: '#commander-femiglow',
        displayOrder: order,
      }),
    );
  const patchSegment = (segId: string, patch: Partial<AdminSegment>) =>
    run(() => api(`/api/admin/stories/segments/${segId}`, 'PATCH', patch));
  const deleteSegment = (segId: string) =>
    run(() => api(`/api/admin/stories/segments/${segId}`, 'DELETE'));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-900">Stories vidéo</h1>
        <p className="text-sm text-stone-500">
          Gère les stories de <code>/kit</code> (bulles + segments vidéo). Les vidéos sont des
          chemins servis par le site (ex. <code>/stories/1.mp4</code>).
        </p>
      </div>

      {totals ? (
        <div className="flex flex-wrap gap-4 rounded-lg border border-stone-200 bg-white p-4 text-sm">
          <span className="text-xs uppercase tracking-wide text-stone-400">30 j</span>
          <span><b>{totals.opens}</b> ouvertures</span>
          <span><b>{totals.completes}</b> complétions</span>
          <span>complétion <b>{pct(totals.completionRate)}</b></span>
          <span><b>{totals.ctaClicks}</b> CTA</span>
          <span>CTR <b>{pct(totals.ctr)}</b></span>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {/* Création */}
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-800">Nouvelle story</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="text-stone-600">Slug</span>
            <input className={inputCls} value={nSlug} onChange={(e) => setNSlug(e.target.value)} placeholder="kit-nouvelle" />
          </label>
          <label className="text-sm">
            <span className="text-stone-600">Titre (fr)</span>
            <input className={inputCls} value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="Ma story" />
          </label>
          <label className="text-sm">
            <span className="text-stone-600">Poster bulle (URL)</span>
            <input className={inputCls} value={nPoster} onChange={(e) => setNPoster(e.target.value)} placeholder="/stories/1.jpg" />
          </label>
        </div>
        <button
          type="button"
          disabled={busy || !nSlug || !nPoster}
          onClick={createStory}
          className={`${btn} mt-3 bg-stone-900 text-white`}
        >
          Créer la story
        </button>
      </div>

      {/* Liste */}
      <div className="space-y-4">
        {stories.map((story, i) => {
          const m = metricsByStory[story.id];
          return (
          <div key={story.id} data-testid={`admin-story-${story.slug}`} className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                className="flex-1 rounded border border-stone-300 px-2 py-1 text-sm font-medium"
                defaultValue={story.titleI18n.fr ?? ''}
                onBlur={(e) => patchStory(story.id, { titleI18n: { ...story.titleI18n, fr: e.target.value } })}
                aria-label="Titre fr"
              />
              <code className="text-xs text-stone-400">{story.slug}</code>
              <label className="flex items-center gap-1 text-xs text-stone-600">
                <input
                  type="checkbox"
                  checked={story.isActive}
                  onChange={(e) => patchStory(story.id, { isActive: e.target.checked })}
                />
                Active
              </label>
              <button type="button" disabled={busy || i === 0} onClick={() => moveStory(i, -1)} className={`${btn} bg-stone-100`}>↑</button>
              <button type="button" disabled={busy || i === stories.length - 1} onClick={() => moveStory(i, 1)} className={`${btn} bg-stone-100`}>↓</button>
              <button type="button" disabled={busy} onClick={() => deleteStory(story.id)} className={`${btn} bg-red-600 text-white`}>Supprimer</button>
            </div>

            {m ? (
              <p className="mt-1.5 text-xs text-stone-500" data-testid={`admin-story-metrics-${story.slug}`}>
                {m.opens} ouv · {m.completes} compl · complétion {pct(m.completionRate)} · {m.ctaClicks} CTA · CTR {pct(m.ctr)}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-stone-400">Aucune donnée (30 j).</p>
            )}

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-stone-600">
                Poster bulle
                <input className={inputCls} defaultValue={story.bubblePosterUrl} onBlur={(e) => patchStory(story.id, { bubblePosterUrl: e.target.value })} />
              </label>
              <label className="text-xs text-stone-600">
                Titre (ar)
                <input className={inputCls} defaultValue={story.titleI18n.ar ?? ''} onBlur={(e) => patchStory(story.id, { titleI18n: { ...story.titleI18n, ar: e.target.value } })} dir="rtl" />
              </label>
            </div>

            {/* Segments */}
            <div className="mt-3 border-t border-stone-100 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Segments ({story.segments.length})</h3>
                <button type="button" disabled={busy} onClick={() => addSegment(story.id, story.segments.length)} className={`${btn} bg-stone-800 text-white`}>+ Segment</button>
              </div>
              <div className="space-y-2">
                {story.segments.map((seg) => (
                  <div key={seg.id} data-testid={`admin-segment-${seg.id}`} className="grid gap-2 rounded border border-stone-100 bg-stone-50 p-2 sm:grid-cols-[1fr_1fr_90px_auto_auto]">
                    <input className="rounded border border-stone-300 px-2 py-1 text-xs" defaultValue={seg.videoUrl} onBlur={(e) => patchSegment(seg.id, { videoUrl: e.target.value })} aria-label="URL vidéo" placeholder="/stories/1.mp4" />
                    <input className="rounded border border-stone-300 px-2 py-1 text-xs" defaultValue={seg.posterUrl} onBlur={(e) => patchSegment(seg.id, { posterUrl: e.target.value })} aria-label="Poster" placeholder="/stories/1.jpg" />
                    <input className="rounded border border-stone-300 px-2 py-1 text-xs" type="number" defaultValue={seg.durationMs} onBlur={(e) => patchSegment(seg.id, { durationMs: Number(e.target.value) || 0 })} aria-label="Durée (ms)" />
                    <label className="flex items-center gap-1 text-xs text-stone-600">
                      <input type="checkbox" checked={seg.isActive} onChange={(e) => patchSegment(seg.id, { isActive: e.target.checked })} />
                      Active
                    </label>
                    <button type="button" disabled={busy} onClick={() => deleteSegment(seg.id)} className={`${btn} bg-red-500 text-white`}>×</button>
                  </div>
                ))}
                {story.segments.length === 0 ? (
                  <p className="text-xs text-stone-400">Aucun segment — ajoute au moins un clip.</p>
                ) : null}
              </div>
            </div>
          </div>
          );
        })}
        {stories.length === 0 ? <p className="text-sm text-stone-500">Aucune story. Crée la première ci-dessus.</p> : null}
      </div>
    </div>
  );
}
