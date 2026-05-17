'use client';

import { useEffect, useState } from 'react';
import type {
  ContentBrief,
  ContentDraft,
  ContentPost,
  ContentPostizDelivery,
} from '@/lib/content-studio/types';
import type {
  DraftAssetsByDraftId,
  Integration,
  MediaCompartment,
  RunFunction,
  StudioMediaItem,
} from './types';
import { SectionTitle } from './SectionTitle';
import { DeliveryStatusBadge } from './DeliveryStatusBadge';
import { PlatformPreview } from './PlatformPreview';
import { RejectDialog } from './RejectDialog';
import { CancelDialog } from './CancelDialog';
import { ArchiveButton } from './ArchiveButton';
import { BriefEditor } from './BriefEditor';
import { postJson, patchJson, getJson } from './api';
import { draftUpdateSchema } from '@/lib/content-studio/schemas';
import {
  extractUploadedImage,
  defaultScheduleValue,
  toIsoOrNull,
  defaultVisualPrompt,
} from './helpers';

export function DraftEditor({
  drafts,
  selectedDraft,
  selectedPost,
  selectedAsset,
  selectedDeliveries,
  mediaItems,
  integrations,
  disabled,
  setDrafts,
  setPosts,
  setDraftAssets,
  setDeliveries,
  setMediaItems,
  setSelectedDraftId,
  run,
  setMessage,
}: {
  drafts: ContentDraft[];
  selectedDraft: ContentDraft | null;
  selectedPost: ContentPost | null;
  selectedAsset: DraftAssetsByDraftId[string] | null;
  selectedDeliveries: ContentPostizDelivery[];
  mediaItems: StudioMediaItem[];
  integrations: Integration[];
  disabled: boolean;
  setDrafts: (updater: (current: ContentDraft[]) => ContentDraft[]) => void;
  setPosts: (updater: (current: ContentPost[]) => ContentPost[]) => void;
  setDraftAssets: (updater: (current: DraftAssetsByDraftId) => DraftAssetsByDraftId) => void;
  setDeliveries: (updater: (current: ContentPostizDelivery[]) => ContentPostizDelivery[]) => void;
  setMediaItems: (items: StudioMediaItem[]) => void;
  setSelectedDraftId: (id: string) => void;
  run: RunFunction;
  setMessage: (message: string | null) => void;
}) {
  const [caption, setCaption] = useState(selectedDraft?.caption ?? '');
  const [mediaId, setMediaId] = useState(selectedAsset?.mediaId ?? '');
  const [mediaQuery, setMediaQuery] = useState('');
  const [mediaCompartment, setMediaCompartment] = useState<MediaCompartment>('imported');
  const [integrationId, setIntegrationId] = useState('');
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleValue());
  const [brief, setBrief] = useState<ContentBrief | null>(null);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!selectedDraft?.briefId) {
      setBrief(null);
      return;
    }
    let cancelled = false;
    void getJson<{ brief: ContentBrief }>(`/api/admin/content-studio/briefs/${selectedDraft.briefId}`)
      .then((value) => {
        if (!cancelled) setBrief(value.brief);
      })
      .catch(() => {
        if (!cancelled) setBrief(null);
      });
    return () => { cancelled = true; };
  }, [selectedDraft?.briefId]);

  if (!selectedDraft) {
    return (
      <div className="rounded-md border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
        Générez une idée pour ouvrir l&apos;éditeur.
      </div>
    );
  }

  const scoreTone =
    selectedDraft.scoreTotal == null
      ? 'bg-stone-100 text-stone-600'
      : selectedDraft.scoreTotal >= 90
        ? 'bg-emerald-50 text-emerald-700'
        : selectedDraft.scoreTotal >= 75
          ? 'bg-amber-50 text-amber-700'
          : 'bg-red-50 text-red-700';

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <div className="rounded-md border border-sky-100 bg-sky-50/40 p-3">
        <SectionTitle
          eyebrow="Production"
          title="Brouillons"
          tone="sky"
          description="Comparer les variantes générées."
        />
        <ul className="mt-3 space-y-2">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedDraftId(draft.id);
                  setCaption(draft.caption);
                  setMediaId('');
                }}
                className={`w-full rounded border px-3 py-2 text-left text-sm ${
                  draft.id === selectedDraft.id
                    ? 'border-sky-900 bg-sky-950 text-white'
                    : 'border-sky-100 bg-white text-stone-700 hover:border-sky-300'
                }`}
                disabled={disabled}
              >
                <span className="block font-medium">{draft.variantLabel}</span>
                <span className="block text-xs opacity-75">
                  {draft.status} · score {draft.scoreTotal ?? '—'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-md border border-stone-200 bg-white p-4 shadow-sm shadow-stone-950/5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
              Édition &amp; validation
            </p>
            <h2 className="text-lg font-semibold text-stone-900">{selectedDraft.variantLabel}</h2>
            <p className="text-xs text-stone-500">
              {selectedDraft.platform} · {selectedDraft.format} · {selectedDraft.status}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${scoreTone}`}>
            Score marque {selectedDraft.scoreTotal ?? '—'}
          </span>
        </div>
        <label className="mt-4 block text-sm">
          <span className="text-xs uppercase tracking-wide text-stone-500">Caption</span>
          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            rows={10}
            className={`mt-1 w-full rounded-md border px-3 py-2 text-sm leading-6 ${
              draftErrors.caption ? 'border-red-300 bg-red-50' : 'border-stone-200'
            }`}
          />
          {draftErrors.caption ? (
            <p className="mt-1 text-xs text-red-700">{draftErrors.caption}</p>
          ) : null}
        </label>
        <MediaPicker
          mediaItems={mediaItems}
          selectedMediaId={mediaId || selectedAsset?.mediaId || ''}
          selectedAsset={selectedAsset}
          query={mediaQuery}
          compartment={mediaCompartment}
          disabled={disabled}
          setQuery={setMediaQuery}
          setCompartment={setMediaCompartment}
          setSelectedMediaId={setMediaId}
          setMediaItems={setMediaItems}
        />
        <VisualGenerator
          key={selectedDraft.id}
          draft={selectedDraft}
          mediaItems={mediaItems}
          disabled={disabled}
          run={run}
          setMediaItems={setMediaItems}
          setMediaCompartment={setMediaCompartment}
          setSelectedMediaId={setMediaId}
          setMessage={setMessage}
        />
        {brief && (
          <div className="mt-4">
            <BriefEditor
              brief={brief}
              draftStatus={selectedDraft.status}
              disabled={disabled}
              run={run}
              onUpdate={setBrief}
            />
          </div>
        )}
        <div className="mt-4 rounded-md border border-indigo-100 bg-indigo-50/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-wide text-stone-500">Preview réseau</p>
            <p className="text-xs text-stone-500">{selectedDraft.platform}</p>
          </div>
          <PlatformPreview
            caption={caption}
            hashtags={selectedDraft.hashtags ?? []}
            media={
              mediaItems.find((item) => item.id === (mediaId || selectedAsset?.mediaId)) ??
              selectedAsset?.media ??
              null
            }
          />
        </div>
        <DeliveryPanel
          selectedPost={selectedPost}
          deliveries={selectedDeliveries}
          integrations={integrations}
          integrationId={integrationId}
          setIntegrationId={setIntegrationId}
          scheduledAt={scheduledAt}
          setScheduledAt={setScheduledAt}
          disabled={disabled}
          run={run}
          setDeliveries={setDeliveries}
          setPosts={setPosts}
          setMessage={setMessage}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setDraftErrors({});
              const patch = { caption, mediaId: mediaId || selectedAsset?.mediaId || undefined };
              const parsed = draftUpdateSchema.safeParse(patch);
              if (!parsed.success) {
                const fieldErrors: Record<string, string> = {};
                for (const issue of parsed.error.issues) {
                  const key = issue.path.join('.');
                  fieldErrors[key] = issue.message;
                }
                setDraftErrors(fieldErrors);
                return;
              }
              run(
                async () =>
                  patchJson<{ draft: ContentDraft }>(
                    `/api/admin/content-studio/drafts/${selectedDraft.id}`,
                    parsed.data,
                  ),
                (value) => {
                  setDrafts((current) =>
                    current.map((draft) => (draft.id === value.draft.id ? value.draft : draft)),
                  );
                  const selectedMedia =
                    mediaItems.find((item) => item.id === (mediaId || selectedAsset?.mediaId)) ??
                    selectedAsset?.media ??
                    null;
                  if (mediaId || selectedAsset?.mediaId) {
                    setDraftAssets((current) => ({
                      ...current,
                      [value.draft.id]: {
                        mediaId: mediaId || selectedAsset?.mediaId || '',
                        media: selectedMedia,
                      },
                    }));
                  }
                  setMessage('Brouillon sauvegardé, média associé et contenu relu.');
                },
              )
            }}
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 disabled:opacity-50"
          >
            Sauvegarder + relire
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              run(
                async () =>
                  postJson<{ post: ContentPost }>(
                    `/api/admin/content-studio/drafts/${selectedDraft.id}/approve`,
                    {},
                  ),
                (value) => {
                  setPosts((current) => {
                    if (current.some((post) => post.id === value.post.id)) return current;
                    return [value.post, ...current];
                  });
                  setDrafts((current) =>
                    current.map((draft) =>
                      draft.id === selectedDraft.id ? { ...draft, status: 'approved' } : draft,
                    ),
                  );
                  setMessage('Brouillon approuvé.');
                },
              )
            }
            className="rounded-md bg-emerald-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Approuver
          </button>
          {selectedDraft.status === 'needs_review' && (
            <RejectDialog
              draftId={selectedDraft.id}
              disabled={disabled}
              onRejected={(updated) => {
                setDrafts((current) =>
                  current.map((d) =>
                    d.id === updated.id ? { ...d, status: updated.status as ContentDraft['status'], rejectionReason: updated.rejectionReason } : d,
                  ),
                );
                setMessage('Brouillon rejeté.');
              }}
              run={run}
            />
          )}
          <ArchiveButton
            entityType="draft"
            entityId={selectedDraft.id}
            disabled={disabled}
            onArchived={() => {
              setDrafts((current) => current.filter((d) => d.id !== selectedDraft.id));
              const nextDraft = drafts.find((d) => d.id !== selectedDraft.id);
              setSelectedDraftId(nextDraft?.id ?? '');
              setMessage('Brouillon archivé.');
            }}
            run={run}
          />
        </div>
        {!selectedAsset && !mediaId ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Associez un média avant Postiz pour vérifier le rendu social complet.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function VisualGenerator({
  draft,
  mediaItems,
  disabled,
  run,
  setMediaItems,
  setMediaCompartment,
  setSelectedMediaId,
  setMessage,
}: {
  draft: ContentDraft;
  mediaItems: StudioMediaItem[];
  disabled: boolean;
  run: RunFunction;
  setMediaItems: (items: StudioMediaItem[]) => void;
  setMediaCompartment: (compartment: MediaCompartment) => void;
  setSelectedMediaId: (id: string) => void;
  setMessage: (message: string | null) => void;
}) {
  const [prompt, setPrompt] = useState(defaultVisualPrompt(draft));
  const [size, setSize] = useState<'1024x1024' | '1024x1536' | '1536x1024'>('1024x1024');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('low');

  return (
    <div className="mt-4 rounded-md border border-violet-100 bg-violet-50/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle
          eyebrow="Visuel IA"
          title="Générer dans le compartiment IA"
          tone="violet"
          description="Créer un média isolé du reste de la médiathèque."
        />
        <div className="flex gap-2">
          <select
            value={size}
            onChange={(event) => setSize(event.target.value as typeof size)}
            className="rounded-md border border-violet-200 bg-white px-2 py-1.5 text-xs"
          >
            <option value="1024x1024">1:1 test</option>
            <option value="1024x1536">4:5 post</option>
            <option value="1536x1024">Paysage</option>
          </select>
          <select
            value={quality}
            onChange={(event) => setQuality(event.target.value as typeof quality)}
            className="rounded-md border border-violet-200 bg-white px-2 py-1.5 text-xs"
          >
            <option value="low">Brouillon</option>
            <option value="medium">Standard</option>
            <option value="high">Haute</option>
          </select>
        </div>
      </div>
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        rows={3}
        className="mt-3 w-full rounded-md border border-violet-200 bg-white px-3 py-2 text-sm leading-6"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || prompt.trim().length < 12}
          onClick={() =>
            run(
              async () =>
                postJson<{ media: StudioMediaItem }>(
                  `/api/admin/content-studio/drafts/${draft.id}/generate-visual`,
                  { prompt, size, quality },
                ),
              (value) => {
                setMediaCompartment('ai_generated');
                setSelectedMediaId(value.media.id);
                setMediaItems([
                  value.media,
                  ...mediaItems.filter((item) => item.id !== value.media.id),
                ]);
                setMessage('Visuel IA généré, optimisé et sélectionné.');
              },
            )
          }
          className="rounded-md bg-violet-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Générer le visuel
        </button>
        <p className="text-xs text-violet-900">
          Par défaut en staging, le mode test ne consomme pas de crédit OpenAI.
        </p>
      </div>
    </div>
  );
}

function MediaPicker({
  mediaItems,
  selectedMediaId,
  selectedAsset,
  query,
  compartment,
  disabled,
  setQuery,
  setCompartment,
  setSelectedMediaId,
  setMediaItems,
}: {
  mediaItems: StudioMediaItem[];
  selectedMediaId: string;
  selectedAsset: DraftAssetsByDraftId[string] | null;
  query: string;
  compartment: MediaCompartment;
  disabled: boolean;
  setQuery: (query: string) => void;
  setCompartment: (compartment: MediaCompartment) => void;
  setSelectedMediaId: (id: string) => void;
  setMediaItems: (items: StudioMediaItem[]) => void;
}) {
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const selectedMedia =
    mediaItems.find((item) => item.id === selectedMediaId) ?? selectedAsset?.media ?? null;
  const selectedCompartmentLabel =
    selectedMedia?.compartment === 'ai_generated' ? 'Généré IA' : 'Importé';

  function mediaUrl(nextCompartment = compartment) {
    const params = new URLSearchParams({ compartment: nextCompartment });
    if (query.trim()) params.set('q', query.trim());
    return `/api/admin/content-studio/media?${params.toString()}`;
  }

  function loadMedia(nextCompartment = compartment) {
    setIsLoadingMedia(true);
    void getJson<{ media: StudioMediaItem[] }>(mediaUrl(nextCompartment))
      .then((value) => setMediaItems(value.media))
      .catch(() => setMediaItems([]))
      .finally(() => setIsLoadingMedia(false));
  }

  useEffect(() => {
    let cancelled = false;
    setIsLoadingMedia(true);
    const timeout = window.setTimeout(() => {
      void getJson<{ media: StudioMediaItem[] }>(mediaUrl(compartment))
        .then((value) => {
          if (!cancelled) setMediaItems(value.media);
        })
        .catch(() => {
          if (!cancelled) setMediaItems([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoadingMedia(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [compartment, query, setMediaItems]);

  return (
    <div className="mt-4 rounded-md border border-amber-100 bg-amber-50/40 p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Média associé
          </p>
          <p className="mt-1 text-sm text-stone-700">
            {selectedMedia ? selectedMedia.alt : 'Aucun média sélectionné.'}
          </p>
          {selectedMedia ? (
            <p className="mt-1 text-xs text-amber-800">
              Compartiment actif : {selectedCompartmentLabel}
            </p>
          ) : null}
        </div>
        <div className="flex rounded-md border border-amber-200 bg-white p-1">
          {[
            ['imported', 'Importés'],
            ['ai_generated', 'Générés IA'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => {
                const next = value as MediaCompartment;
                setMediaItems([]);
                setCompartment(next);
              }}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                compartment === value
                  ? 'bg-amber-900 text-white'
                  : 'text-amber-900 hover:bg-amber-50'
              } disabled:opacity-50`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="block text-sm">
          <span className="text-xs text-stone-500">Rechercher</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-1 w-52 rounded-md border border-stone-200 px-3 py-2 text-sm"
            placeholder="slug, alt, caption"
          />
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={() => loadMedia()}
          className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-950 disabled:opacity-50"
        >
          Actualiser
        </button>
      </div>
      <p className="mt-3 rounded border border-amber-100 bg-white px-3 py-2 text-xs leading-5 text-stone-600">
        Les médias importés restent la médiathèque FemiGlow classique. Les médias générés par IA
        restent isolés dans le Studio, mais les deux compartiments peuvent être sélectionnés pour
        préparer un post.
      </p>
      <div className="mt-3 grid max-h-72 gap-2 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
        {isLoadingMedia ? (
          <p className="text-sm text-stone-500">Chargement des médias...</p>
        ) : mediaItems.length === 0 ? (
          <p className="text-sm text-stone-500">
            Aucun média prêt trouvé dans ce compartiment.
          </p>
        ) : (
          mediaItems.map((media) => (
            <button
              key={media.id}
              type="button"
              onClick={() => setSelectedMediaId(media.id)}
              className={`rounded border p-2 text-left ${
                media.id === selectedMediaId
                  ? 'border-amber-700 bg-amber-50'
                  : 'border-amber-100 bg-white hover:border-amber-300'
              }`}
            >
              <div className="aspect-[4/5] overflow-hidden rounded bg-stone-100">
                {media.previewUrl ? (
                  <img
                    src={media.previewUrl}
                    alt={media.alt}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-stone-400">
                    Sans aperçu
                  </div>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-xs font-medium text-stone-800">{media.alt}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="truncate text-xs text-stone-500">{media.slug}</p>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    media.compartment === 'ai_generated'
                      ? 'bg-violet-50 text-violet-800'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {media.compartment === 'ai_generated' ? 'IA' : 'Media'}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function DeliveryPanel({
  selectedPost,
  deliveries,
  integrations,
  integrationId,
  setIntegrationId,
  scheduledAt,
  setScheduledAt,
  disabled,
  run,
  setDeliveries,
  setPosts,
  setMessage,
}: {
  selectedPost: ContentPost | null;
  deliveries: ContentPostizDelivery[];
  integrations: Integration[];
  integrationId: string;
  setIntegrationId: (id: string) => void;
  scheduledAt: string;
  setScheduledAt: (value: string) => void;
  disabled: boolean;
  run: RunFunction;
  setDeliveries: (updater: (current: ContentPostizDelivery[]) => ContentPostizDelivery[]) => void;
  setPosts: (updater: (current: ContentPost[]) => ContentPost[]) => void;
  setMessage: (message: string | null) => void;
}) {
  const latest = deliveries[0] ?? null;
  const uploaded = latest ? extractUploadedImage(latest) : null;

  return (
    <div className="mt-4 rounded-md border border-violet-100 bg-violet-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle
          eyebrow="Publication"
          title="Postiz"
          tone="violet"
          description="Upload média, création du draft et diagnostic."
        />
        <DeliveryStatusBadge status={latest?.status ?? 'pending'} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(180px,260px)_1fr]">
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-xs font-medium text-violet-800">Compte social</span>
            <select
              value={integrationId}
              onChange={(event) => setIntegrationId(event.target.value)}
              className="mt-1 w-full rounded-md border border-violet-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Compte Postiz</option>
              {integrations.map((integration) => (
                <option key={integration.id} value={integration.id}>
                  {integration.provider} · {integration.name ?? integration.identifier ?? integration.id}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-violet-800">Date cible</span>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              className="mt-1 w-full rounded-md border border-violet-200 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="rounded border border-violet-100 bg-white px-3 py-2 text-xs text-stone-600">
          {latest ? (
            <div className="space-y-1">
              <p>
                Dernière livraison : <span className="font-medium text-stone-900">{latest.id}</span>
              </p>
              <p>
                Média Postiz :{' '}
                <span className="font-medium text-stone-900">{uploaded?.id ?? 'non disponible'}</span>
              </p>
              {uploaded?.path ? (
                <p className="truncate">
                  URL :{' '}
                  <a className="text-violet-800 underline" href={uploaded.path} target="_blank" rel="noopener noreferrer">
                    {uploaded.path}
                  </a>
                </p>
              ) : null}
              {latest.lastError ? <p className="text-red-700">{latest.lastError}</p> : null}
            </div>
          ) : (
            <p>Aucune livraison Postiz pour ce post.</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || !selectedPost || !integrationId}
          onClick={() => {
            if (!selectedPost) return;
            run(
              async () =>
                postJson<{ delivery: ContentPostizDelivery; post: ContentPost }>(
                  `/api/admin/content-studio/posts/${selectedPost.id}/postiz-draft`,
                  { integrationId, scheduledAt: toIsoOrNull(scheduledAt) },
                ),
              (value) => {
                setDeliveries((current) => [value.delivery, ...current]);
                setPosts((current) =>
                  current.map((post) => (post.id === value.post.id ? value.post : post)),
                );
                setMessage(
                  latest?.status === 'failed'
                    ? 'Nouvel essai Postiz terminé.'
                    : 'Brouillon créé dans Postiz avec média uploadé.',
                );
              },
            );
          }}
          className="rounded-md bg-violet-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {latest?.status === 'failed' || latest?.status === 'auth_failed'
            ? 'Réessayer Postiz'
            : 'Uploader + créer draft'}
        </button>
        {selectedPost?.status === 'scheduled' && (
          <CancelDialog
            postId={selectedPost.id}
            disabled={disabled}
            onCancelled={(updated) => {
              setPosts((current) =>
                current.map((p) =>
                  p.id === updated.id ? { ...p, status: updated.status as ContentPost['status'] } : p,
                ),
              );
              setMessage('Publication annulée.');
            }}
            run={run}
          />
        )}
        {selectedPost && (
          <ArchiveButton
            entityType="post"
            entityId={selectedPost.id}
            disabled={disabled}
            onArchived={() => {
              setPosts((current) => current.filter((p) => p.id !== selectedPost.id));
              setMessage('Post archivé.');
            }}
            run={run}
          />
        )}
        <p className="self-center text-xs text-violet-900">
          Le média est uploadé dans Postiz avant création du draft.
        </p>
      </div>
    </div>
  );
}