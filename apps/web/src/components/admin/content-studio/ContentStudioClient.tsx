'use client';

import { useEffect, useMemo, useState, useTransition, type Dispatch, type SetStateAction } from 'react';
import type {
  ContentDraft,
  ContentFormat,
  ContentIdea,
  ContentObjective,
  ContentPillar,
  ContentPlatform,
  ContentPost,
  ContentPostizDelivery,
  ContentPerformanceSnapshot,
} from '@/lib/content-studio/types';
import {
  CONTENT_FORMATS,
  CONTENT_OBJECTIVES,
  CONTENT_PILLARS,
  CONTENT_PLATFORMS,
} from '@/lib/content-studio/types';
import type { Integration, StudioMediaItem, DraftAssetsByDraftId, MediaCompartment, AutomationResponse } from './types';

interface Props {
  initialIdeas: ContentIdea[];
  initialDrafts: ContentDraft[];
  initialPosts: ContentPost[];
  initialDraftAssets: DraftAssetsByDraftId;
  initialDeliveries: ContentPostizDelivery[];
  initialSnapshots: ContentPerformanceSnapshot[];
  enabled: boolean;
}

export function ContentStudioClient({
  initialIdeas,
  initialDrafts,
  initialPosts,
  initialDraftAssets,
  initialDeliveries,
  initialSnapshots,
  enabled,
}: Props) {
  const [ideas, setIdeas] = useState(initialIdeas);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [posts, setPosts] = useState(initialPosts);
  const [draftAssets, setDraftAssets] = useState<DraftAssetsByDraftId>(initialDraftAssets);
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [mediaItems, setMediaItems] = useState<StudioMediaItem[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState(initialDrafts[0]?.id ?? '');
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedDraft = useMemo(
    () => drafts.find((draft) => draft.id === selectedDraftId) ?? drafts[0] ?? null,
    [drafts, selectedDraftId],
  );
  const selectedPost = selectedDraft
    ? posts.find((post) => post.draftId === selectedDraft.id) ?? null
    : null;
  const selectedAsset = selectedDraft ? draftAssets[selectedDraft.id] ?? null : null;
  const selectedDeliveries = selectedPost
    ? deliveries.filter((delivery) => delivery.postId === selectedPost.id)
    : [];

  if (!enabled) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Content Studio est désactivé. Activez <code>CONTENT_STUDIO_ENABLED=true</code> en
        staging pour utiliser le prototype.
      </div>
    );
  }

  function run<T>(action: () => Promise<T>, onSuccess: (value: T) => void) {
    setError(null);
    setMessage(null);
    startTransition(() => {
      void action()
        .then((value) => {
          onSuccess(value);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err));
        });
    });
  }

  return (
    <div className="space-y-5">
      <StudioGuide />
      <EditorialCalendar posts={posts} drafts={drafts} deliveries={deliveries} />
      <PostizHealthPanel
        posts={posts}
        drafts={drafts}
        deliveries={deliveries}
        snapshots={snapshots}
        disabled={isPending}
        setDeliveries={setDeliveries}
        setSnapshots={setSnapshots}
        run={run}
        setMessage={setMessage}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <section className="space-y-4">
          <IdeaForm
            disabled={isPending}
            onCreate={(idea) => setIdeas((current) => [idea, ...current])}
            run={run}
          />
          <div className="rounded-md border border-rose-100 bg-rose-50/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle
                eyebrow="File d’idées"
                title="Idées"
                tone="rose"
                description="Les intentions éditoriales prêtes à générer."
              />
            </div>
            <ul className="mt-3 space-y-2">
              {ideas.length === 0 ? (
                <li className="text-sm text-stone-500">Aucune idée pour le moment.</li>
              ) : (
                ideas.map((idea) => (
                  <li key={idea.id} className="rounded border border-rose-100 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-stone-900">{idea.prompt}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          {idea.pillar} · {idea.objective} · {idea.platform}/{idea.format}
                        </p>
                      </div>
                      <span className="rounded bg-rose-50 px-2 py-1 text-xs font-medium text-rose-800">
                        {idea.status}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        run(
                          async () => postJson<{ drafts: ContentDraft[]; idea: ContentIdea }>(
                            `/api/admin/content-studio/ideas/${idea.id}/generate`,
                            {},
                          ),
                          (value) => {
                            setIdeas((current) =>
                              current.map((item) =>
                                item.id === value.idea.id ? value.idea : item,
                              ),
                            );
                            setDrafts((current) => [...value.drafts, ...current]);
                            setSelectedDraftId(value.drafts[0]?.id ?? '');
                            setMessage('Brouillons générés et scorés.');
                          },
                        )
                      }
                      className="mt-3 rounded-md bg-rose-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Générer 3 propositions
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
          <PostizPanel
            integrations={integrations}
            setIntegrations={setIntegrations}
            disabled={isPending}
            run={run}
          />
        </section>

        <section className="space-y-4">
          {message ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          <DraftEditor
            drafts={drafts}
            selectedDraft={selectedDraft}
            selectedPost={selectedPost}
            selectedAsset={selectedAsset}
            selectedDeliveries={selectedDeliveries}
            mediaItems={mediaItems}
            integrations={integrations}
            disabled={isPending}
            setDrafts={setDrafts}
            setPosts={setPosts}
            setDeliveries={setDeliveries}
            setDraftAssets={setDraftAssets}
            setMediaItems={setMediaItems}
            setSelectedDraftId={setSelectedDraftId}
            run={run}
            setMessage={setMessage}
          />
        </section>
      </div>
    </div>
  );
}

function StudioGuide() {
  return (
    <details className="group rounded-md border border-stone-200 bg-stone-50/70 px-4 py-3 text-sm text-stone-700">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-semibold text-stone-900">
            Comment utiliser ce studio
          </span>
          <span className="mt-0.5 block text-xs text-stone-500">
            Workflow court : idée, propositions, relecture marque, validation, draft Postiz.
          </span>
        </span>
        <span className="shrink-0 rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-600 group-open:hidden">
          Ouvrir
        </span>
        <span className="hidden shrink-0 rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-600 group-open:inline">
          Fermer
        </span>
      </summary>
      <div className="mt-4 grid gap-3 border-t border-stone-200 pt-4 md:grid-cols-4">
        <div className="rounded border border-stone-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">1. Cadrer</p>
          <p className="mt-1 text-sm leading-6">
            Choisis le pilier, l'objectif, la plateforme et le format. L'intention doit expliquer
            le message à produire, pas seulement un titre.
          </p>
        </div>
        <div className="rounded border border-stone-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">2. Générer</p>
          <p className="mt-1 text-sm leading-6">
            Le studio crée trois brouillons de texte, les relit avec les règles FemiGlow et affiche
            un score marque pour prioriser la meilleure piste.
          </p>
        </div>
        <div className="rounded border border-stone-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">3. Visuel</p>
          <p className="mt-1 text-sm leading-6">
            Génère un visuel IA dans le compartiment dédié ou choisis un média importé. Les deux
            compartiments sont sélectionnables pour le post.
          </p>
        </div>
        <div className="rounded border border-stone-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">4. Publier</p>
          <p className="mt-1 text-sm leading-6">
            Modifie la caption, sauvegarde pour relire, approuve, synchronise Postiz puis crée un
            brouillon social. Rien n'est publié automatiquement.
          </p>
        </div>
      </div>
      <div className="mt-3 rounded border border-violet-200 bg-violet-50 px-3 py-2 text-xs leading-5 text-violet-900">
        Le mode visuel IA est en <strong>mode test</strong> par défaut (pas de crédit OpenAI consommé).
        Pour activer la génération réelle, configurez <code>CONTENT_STUDIO_IMAGE_PROVIDER=openai</code> et
        <code> CONTENT_STUDIO_OPENAI_API_KEY</code>. Les visuels générés restent isolés dans le compartiment
        IA du Studio et n'apparaissent pas dans la médiathèque classique FemiGlow.
      </div>
    </details>
  );
}

function IdeaForm({
  disabled,
  onCreate,
  run,
}: {
  disabled: boolean;
  onCreate: (idea: ContentIdea) => void;
  run: <T>(action: () => Promise<T>, onSuccess: (value: T) => void) => void;
}) {
  const [pillar, setPillar] = useState<ContentPillar>('rituel');
  const [objective, setObjective] = useState<ContentObjective>('consideration');
  const [platform, setPlatform] = useState<ContentPlatform>('instagram');
  const [format, setFormat] = useState<ContentFormat>('post');
  const [prompt, setPrompt] = useState('Présenter le rituel FemiGlow comme un geste lent du soir');

  return (
    <form
      className="rounded-md border border-rose-100 bg-white p-4 shadow-sm shadow-rose-950/5"
      onSubmit={(event) => {
        event.preventDefault();
        run(
          async () =>
            postJson<{ idea: ContentIdea }>('/api/admin/content-studio/ideas', {
              pillar,
              objective,
              platform,
              format,
              prompt,
            }),
          (value) => onCreate(value.idea),
        );
      }}
    >
      <SectionTitle
        eyebrow="Cadrage"
        title="Créer une idée"
        tone="rose"
        description="Définir l’intention avant toute génération."
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Select label="Pilier" value={pillar} values={CONTENT_PILLARS} onChange={setPillar} />
        <Select
          label="Objectif"
          value={objective}
          values={CONTENT_OBJECTIVES}
          onChange={setObjective}
        />
        <Select
          label="Plateforme"
          value={platform}
          values={CONTENT_PLATFORMS}
          onChange={setPlatform}
        />
        <Select label="Format" value={format} values={CONTENT_FORMATS} onChange={setFormat} />
      </div>
      <label className="mt-3 block text-sm">
        <span className="text-xs uppercase tracking-wide text-stone-500">Intention</span>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={disabled}
        className="mt-3 rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Enregistrer l’idée
      </button>
    </form>
  );
}

function DraftEditor({
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
  run: <T>(action: () => Promise<T>, onSuccess: (value: T) => void) => void;
  setMessage: (message: string | null) => void;
}) {
  const [caption, setCaption] = useState(selectedDraft?.caption ?? '');
  const [mediaId, setMediaId] = useState(selectedAsset?.mediaId ?? '');
  const [mediaQuery, setMediaQuery] = useState('');
  const [mediaCompartment, setMediaCompartment] = useState<MediaCompartment>('imported');
  const [integrationId, setIntegrationId] = useState('');
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleValue());

  if (!selectedDraft) {
    return (
      <div className="rounded-md border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
        Générez une idée pour ouvrir l’éditeur.
      </div>
    );
  }

  if (caption !== selectedDraft.caption && selectedDraft.id !== '') {
    // Keep the editor simple when switching cards.
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
              Édition & validation
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
            className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 text-sm leading-6"
          />
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
            onClick={() =>
              run(
                async () =>
                  patchJson<{ draft: ContentDraft }>(
                    `/api/admin/content-studio/drafts/${selectedDraft.id}`,
                    { caption, mediaId: mediaId || selectedAsset?.mediaId || undefined },
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
            }
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
  run: <T>(action: () => Promise<T>, onSuccess: (value: T) => void) => void;
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

function PlatformPreview({
  caption,
  hashtags,
  media,
}: {
  caption: string;
  hashtags: string[];
  media: StudioMediaItem | null;
}) {
  return (
    <div className="mt-3 max-w-md rounded-md border border-stone-200 bg-white">
      <div className="flex items-center gap-2 border-b border-stone-200 px-3 py-2">
        <div className="h-7 w-7 rounded-full bg-stone-900" />
        <div>
          <p className="text-xs font-semibold text-stone-900">FemiGlow Maroc</p>
          <p className="text-xs text-stone-500">Brouillon preview</p>
        </div>
      </div>
      <div className="aspect-[4/5] bg-stone-100">
        {media?.previewUrl ? (
          <img src={media.previewUrl} alt={media.alt} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-stone-500">
            Sélectionnez un média pour vérifier le rendu avant Postiz.
          </div>
        )}
      </div>
      <div className="space-y-2 px-3 py-3">
        <p className="whitespace-pre-wrap text-sm leading-6 text-stone-800">{caption}</p>
        <p className="text-xs text-stone-500">{hashtags.map((tag) => `#${tag}`).join(' ')}</p>
      </div>
    </div>
  );
}

function PostizHealthPanel({
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
  run: <T>(action: () => Promise<T>, onSuccess: (value: T) => void) => void;
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
  run: <T>(action: () => Promise<T>, onSuccess: (value: T) => void) => void;
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
                  <a className="text-violet-800 underline" href={uploaded.path} target="_blank">
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
        <p className="self-center text-xs text-violet-900">
          Le média est uploadé dans Postiz avant création du draft.
        </p>
      </div>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  tone,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  tone: 'rose' | 'sky' | 'amber' | 'violet' | 'teal' | 'indigo';
}) {
  const toneClass = {
    rose: 'text-rose-700',
    sky: 'text-sky-700',
    amber: 'text-amber-700',
    violet: 'text-violet-700',
    teal: 'text-teal-700',
    indigo: 'text-indigo-700',
  }[tone];
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide ${toneClass}`}>{eyebrow}</p>
      <h2 className="mt-0.5 text-sm font-semibold text-stone-900">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-stone-500">{description}</p> : null}
    </div>
  );
}

function DeliveryStatusBadge({ status }: { status: ContentPostizDelivery['status'] }) {
  const cls =
    status === 'sent'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : status === 'failed' || status === 'auth_failed'
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-stone-200 bg-white text-stone-600';
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>
      {status === 'sent'
        ? 'Envoyé'
        : status === 'failed'
          ? 'Échec'
          : status === 'auth_failed'
            ? 'Auth Postiz'
            : 'En attente'}
    </span>
  );
}

function EditorialCalendar({
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

function extractUploadedImage(delivery: ContentPostizDelivery): { id?: string; path?: string } | null {
  const posts = delivery.request.posts;
  if (!Array.isArray(posts)) return null;
  const first = posts[0] as { value?: unknown };
  if (!Array.isArray(first.value)) return null;
  const value = first.value[0] as { image?: unknown };
  if (!Array.isArray(value.image)) return null;
  return (value.image[0] as { id?: string; path?: string }) ?? null;
}

function summarizeSnapshot(snapshot: ContentPerformanceSnapshot): string {
  const metrics = snapshot.metrics;
  if (snapshot.source === 'postiz_status') {
    const state = typeof metrics.state === 'string' ? metrics.state : 'état inconnu';
    const releaseURL = typeof metrics.releaseURL === 'string' ? metrics.releaseURL : null;
    return releaseURL ? `${state} · ${releaseURL}` : state;
  }
  const analytics = metrics.analytics;
  if (Array.isArray(analytics)) return `${analytics.length} métrique(s) analytics importée(s).`;
  if (analytics && typeof analytics === 'object' && 'missing' in analytics) {
    return 'Analytics manquantes : release id à relier côté Postiz.';
  }
  return 'Snapshot importé.';
}

function defaultScheduleValue(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return toLocalDatetimeInput(date);
}

function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toLocalDatetimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatShortDate(value: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function defaultVisualPrompt(draft: ContentDraft): string {
  const hook = draft.hook ? `${draft.hook}. ` : '';
  return `${hook}Visuel beauté naturel FemiGlow, rituel ongles et mains, ambiance premium marocaine douce, lumière naturelle, composition éditoriale propre, sans texte lisible ni promesse médicale.`;
}

function PostizPanel({
  integrations,
  setIntegrations,
  disabled,
  run,
}: {
  integrations: Integration[];
  setIntegrations: (items: Integration[]) => void;
  disabled: boolean;
  run: <T>(action: () => Promise<T>, onSuccess: (value: T) => void) => void;
}) {
  return (
    <div className="rounded-md border border-violet-100 bg-violet-50/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle
          eyebrow="Connexions"
          title="Comptes Postiz"
          tone="violet"
          description="Synchroniser les destinations sociales."
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            run(
              async () =>
                postJson<{ integrations: Integration[] }>(
                  '/api/admin/content-studio/postiz/integrations/sync',
                  {},
                ),
              (value) => setIntegrations(value.integrations),
            )
          }
          className="rounded-md border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-950"
        >
          Sync
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {integrations.length === 0 ? (
          <li className="text-sm text-stone-500">Aucun compte synchronisé.</li>
        ) : (
          integrations.map((integration) => (
            <li key={integration.id} className="rounded border border-violet-100 bg-white px-3 py-2 text-sm">
              <span className="font-medium">{integration.provider}</span>{' '}
              <span className="text-stone-500">{integration.name ?? integration.identifier}</span>
              {integration.disabled ? <span className="text-red-600"> désactivé</span> : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: T;
  values: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs uppercase tracking-wide text-stone-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
      >
        {values.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson<T>(res);
}

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson<T>(res);
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  return parseJson<T>(res);
}

async function parseJson<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  return json;
}
