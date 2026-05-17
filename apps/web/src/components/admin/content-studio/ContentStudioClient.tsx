'use client';

import { useState, useTransition } from 'react';
import type {
  ContentDraft,
  ContentPost,
  ContentIdea,
  ContentPostizDelivery,
  ContentPerformanceSnapshot,
  ContentLearningNote,
} from '@/lib/content-studio/types';
import type { DraftAssetsByDraftId, Integration, RunFunction, StudioMediaItem } from './types';
import { SectionTitle } from './SectionTitle';
import { StudioGuide } from './StudioGuide';
import { EditorialCalendar } from './EditorialCalendar';
import { PostizHealthPanel } from './PostizHealthPanel';
import { IdeaForm } from './IdeaForm';
import { DraftEditor } from './DraftEditor';
import { PostizPanel } from './PostizPanel';
import { ArchiveButton } from './ArchiveButton';
import { LearningNoteForm } from './LearningNoteForm';
import { UtmBuilder } from './UtmBuilder';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { BudgetSummary } from './BudgetSummary';
import { StudioTabs } from './StudioTabs';
import type { StudioTab } from './StudioTabs';
import { postJson } from './api';

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
  const [learningNotes, setLearningNotes] = useState<ContentLearningNote[]>([]);
  const [activeTab, setActiveTab] = useState<StudioTab>('pipeline');
  const [isPending, startTransition] = useTransition();

  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId) ?? drafts[0] ?? null;
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

  const run: RunFunction = (action, onSuccess) => {
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
  };

  return (
    <div className="space-y-5">
      <StudioTabs active={activeTab} onChange={setActiveTab} />
      <StudioGuide />

      {activeTab === 'pipeline' && (
        <>
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
                    eyebrow="File d'idées"
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
                        <ArchiveButton
                          entityType="idea"
                          entityId={idea.id}
                          disabled={isPending}
                          onArchived={() => {
                            setIdeas((current) => current.filter((i) => i.id !== idea.id));
                            setMessage('Idée archivée.');
                          }}
                          run={run}
                        />
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

            <section className="space-y-4" aria-live="polite">
              {message ? (
                <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {message}
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
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
              {selectedPost && (
                <UtmBuilder post={selectedPost} draft={selectedDraft} />
              )}
              <LearningNoteForm
                postId={selectedPost?.id ?? null}
                disabled={isPending}
                onCreated={(note) => setLearningNotes((current) => [note, ...current])}
                run={run}
              />
              {learningNotes.length > 0 && (
                <div className="rounded-md border border-indigo-100 bg-indigo-50/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Notes récentes</p>
                  <ul className="mt-2 space-y-2">
                    {learningNotes.map((n) => (
                      <li key={n.id} className="rounded border border-indigo-100 bg-white p-2 text-sm">
                        <p className="text-stone-800">{n.note}</p>
                        {n.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {n.tags.map((tag) => (
                              <span key={tag} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">{tag}</span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {activeTab === 'calendar' && (
        <>
          <EditorialCalendar posts={posts} drafts={drafts} deliveries={deliveries} onSelectDraft={(id) => { setSelectedDraftId(id); setActiveTab('pipeline'); }} />
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
        </>
      )}

      {activeTab === 'analytics' && (
        <AnalyticsDashboard posts={posts} drafts={drafts} snapshots={snapshots} />
      )}

      {activeTab === 'budget' && (
        <BudgetSummary />
      )}
    </div>
  );
}