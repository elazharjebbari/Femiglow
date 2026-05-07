'use client';

import { useEffect, useState } from 'react';
import type { Media, MediaVariant } from '@/lib/db/types';
import { previewThumbUrl } from '@/lib/media/preview-thumb';

type MediaWithMaybeVariants = Media & {
  variants?: MediaVariant[];
  thumbUrl?: string;
};

interface MediaPickerDrawerProps {
  slotKey: string;
  slotLabel: string;
  acceptKinds?: ('image' | 'video')[];
  onClose: () => void;
  onPick: (mediaId: string) => void;
}

interface MediaListResponse {
  rows: MediaWithMaybeVariants[];
  total: number;
  nextCursor: string | null;
}

export function MediaPickerDrawer({
  slotKey,
  slotLabel,
  acceptKinds,
  onClose,
  onPick,
}: MediaPickerDrawerProps) {
  const [items, setItems] = useState<MediaWithMaybeVariants[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'image' | 'video'>(
    acceptKinds && acceptKinds.length === 1 ? acceptKinds[0]! : 'all',
  );

  useEffect(() => {
    const ctrl = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set('limit', '50');
      params.set('sort', 'created_desc');
      if (q) params.set('q', q);
      if (kindFilter !== 'all') params.set('kind', kindFilter);
      try {
        const res = await fetch(`/api/admin/media?${params.toString()}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error('Erreur lors du chargement des médias');
        const data = (await res.json()) as MediaListResponse;
        const filtered = acceptKinds
          ? data.rows.filter((m) =>
              acceptKinds.includes(m.kind as 'image' | 'video'),
            )
          : data.rows;
        setItems(filtered);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    void load();
    return () => ctrl.abort();
  }, [q, kindFilter, acceptKinds]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const showKindFilter = !acceptKinds || acceptKinds.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="picker-title"
      className="fixed inset-0 z-50 flex"
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
      />
      <aside className="relative ml-auto flex h-full w-full max-w-2xl flex-col border-l border-stone-200 bg-white shadow-xl">
        <header className="flex items-baseline justify-between gap-3 border-b border-stone-200 px-6 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-stone-500">
              Slot · <span className="font-mono">{slotKey}</span>
            </p>
            <h2 id="picker-title" className="text-lg font-semibold text-stone-900">
              Assigner un média à « {slotLabel} »
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            Fermer
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-stone-50 px-6 py-3">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher slug, alt, légende…"
            className="flex-1 min-w-[180px] rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none"
            aria-label="Rechercher un média"
          />
          {showKindFilter && (
            <select
              value={kindFilter}
              onChange={(e) =>
                setKindFilter(e.target.value as 'all' | 'image' | 'video')
              }
              className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900"
              aria-label="Filtrer par type"
            >
              <option value="all">Tous types</option>
              <option value="image">Image</option>
              <option value="video">Vidéo</option>
            </select>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <p
              role="alert"
              className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
            >
              {error}
            </p>
          )}
          {loading ? (
            <p className="text-sm text-stone-500">Chargement…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-stone-500">Aucun média trouvé.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((m) => {
                const aspect =
                  m.originalWidth && m.originalHeight
                    ? `${m.originalWidth} / ${m.originalHeight}`
                    : '4 / 3';
                const bg = m.palette?.[0]?.hex ?? '#f3ede4';
                const thumb = m.thumbUrl ?? previewThumbUrl(m);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => onPick(m.id)}
                      className="group block w-full overflow-hidden rounded-md border border-stone-200 bg-white text-left transition hover:border-stone-900 hover:shadow-md focus-visible:border-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
                      aria-label={`Choisir ${m.slug}`}
                    >
                      <div
                        className="relative w-full"
                        style={{ aspectRatio: aspect, backgroundColor: bg }}
                      >
                        {m.kind === 'image' && thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="px-2 py-2 text-xs">
                        <p className="truncate font-medium text-stone-800">{m.slug}</p>
                        <p className="truncate text-[11px] text-stone-500">
                          {m.kind} · {m.status}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
