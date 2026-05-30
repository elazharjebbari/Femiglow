'use client';

/**
 * Client wrapper used by the `/admin/content-studio-v2/create` page.
 *
 * Wraps the StudioProvider + the 3-column layout (Intention left,
 * MediaStudio + CaptionEditor center, Preview right) + Stepper on top
 * and PublishActionGroup at the bottom.
 *
 * The page itself stays a Server Component (data hydration, auth);
 * this component handles every interactive piece below the shell.
 */

import { useEffect, useMemo, useState } from 'react';
import { Save, GitCompare } from 'lucide-react';
import type { ContentDraft, ContentFormat, ContentIdea, ContentPlatform } from '@/lib/content-studio/types';
import type { StudioV2MediaItem } from '@/lib/content-studio-v2/media/types';
import { StudioProvider, useDraftAutosave, useStudio } from '@/lib/content-studio-v2/state/StudioContext';
import { useCommand, type StudioCommand } from '@/lib/content-studio-v2/state/CommandRegistry';
import type { PreviewFormat, PreviewPlatform } from '@/components/admin/content-studio-v2/media';
import { Stepper } from './Stepper';
import { IntentionForm } from './IntentionForm';
import { VariantsCompare } from './VariantsCompare';
import { CaptionEditor } from './CaptionEditor';
import { MediaStudio } from './MediaStudio';
import { PreviewPane } from './PreviewPane';
import { PublishActionGroup } from './PublishActionGroup';
import { ApproveButton } from './ApproveButton';
import type { ContentPost } from '@/lib/content-studio/types';

interface CreateWorkspaceProps {
  initialIdeas?: ContentIdea[];
  initialDrafts?: ContentDraft[];
  initialMediaItems?: StudioV2MediaItem[];
  initialDraftId?: string | null;
}

export function CreateWorkspace(props: CreateWorkspaceProps) {
  return (
    <StudioProvider
      initial={{
        ideas: props.initialIdeas ?? [],
        drafts: props.initialDrafts ?? [],
        mediaItems: props.initialMediaItems ?? [],
        selectedDraftId: props.initialDraftId ?? null,
      }}
    >
      <CreateWorkspaceInner />
    </StudioProvider>
  );
}

function CreateWorkspaceInner() {
  const {
    drafts,
    setDrafts,
    posts,
    setPosts,
    mediaItems,
    setMediaItems,
    selectedDraftId,
    selectDraft,
    upsertDraft,
    mockMode,
  } = useStudio();

  const [platform, setPlatform] = useState<PreviewPlatform>('instagram');
  const [format, setFormat] = useState<PreviewFormat>('post');
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [livePreview, setLivePreview] = useState<{ caption: string; hook: string | null } | null>(
    null,
  );
  // CS v2 Phase 7 polish (G07) — surface the model + cost used by the last
  // text generation run, so the operator knows what produced the variants.
  const [lastTextRun, setLastTextRun] = useState<{
    model: string;
    provider: string;
    costCents: number;
  } | null>(null);

  const draft = useMemo(
    () => (selectedDraftId ? drafts.find((d) => d.id === selectedDraftId) ?? null : null),
    [drafts, selectedDraftId],
  );
  const post = useMemo(
    () => (draft ? posts.find((p) => p.draftId === draft.id) ?? null : null),
    [draft, posts],
  );

  const variants = useMemo(() => {
    if (!draft) return [];
    return drafts
      .filter((d) => d.briefId === draft.briefId)
      .map((d) => ({ draft: d, score: d.scoreTotal }));
  }, [drafts, draft]);

  const selectedMedia = useMemo(
    () => mediaItems.find((m) => m.id === selectedMediaId) ?? null,
    [mediaItems, selectedMediaId],
  );

  // Keep the preview format in sync with the chosen draft's format.
  useEffect(() => {
    if (!draft) return;
    setFormat(draft.format);
    setPlatform(draft.platform);
  }, [draft]);

  const captionForPreview = livePreview?.caption ?? draft?.caption ?? '';

  const autosave = useDraftAutosave(draft?.id ?? null);

  // Contextual palette commands — visible only when a draft is being edited.
  useCommand(useMemo<StudioCommand | null>(
    () => (draft ? {
      id: 'create.save',
      group: 'Création',
      label: 'Sauvegarder le brouillon',
      shortcut: 'mod+s',
      icon: <Save size={14} />,
      perform: () => { void autosave.flush(); },
    } : null),
    [draft, autosave],
  ));
  useCommand(useMemo<StudioCommand | null>(
    () => (variants.length > 1 ? {
      id: 'create.variants',
      group: 'Création',
      label: `Variantes (${variants.length})`,
      description: 'Comparer les variantes générées pour ce brief',
      icon: <GitCompare size={14} />,
      perform: () => {
        const node = document.querySelector('[data-cs-variants-compare]');
        if (node && 'scrollIntoView' in node) {
          (node as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      },
    } : null),
    [variants.length],
  ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
      <Stepper
        draft={draft}
        hasMedia={Boolean(selectedMediaId)}
        mockMode={mockMode}
        onStepClick={(key) => {
          // CS v2 Phase 7 polish (G10) — scroll the corresponding section
          // into view and focus its first interactive element.
          if (typeof document === 'undefined') return;
          const section = document.querySelector<HTMLElement>(`[data-section="${key}"]`);
          if (!section) return;
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const focusable = section.querySelector<HTMLElement>(
            'input, select, textarea, button:not([disabled])',
          );
          focusable?.focus();
        }}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 280px) minmax(0, 1fr) minmax(320px, 380px)',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        <div
          data-section="frame"
          style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}
        >
          <IntentionForm
            defaultValues={
              draft
                ? {
                    pillar: undefined,
                    objective: undefined,
                    platform: draft.platform,
                    format: draft.format,
                  }
                : undefined
            }
            onFormatChange={(next) => {
              setFormat(next as PreviewFormat);
            }}
            onCreated={async (idea, model) => {
              // After creating an idea, propagate platform+format hints to the preview.
              setPlatform(idea.platform as PreviewPlatform);
              setFormat(idea.format as PreviewFormat);
              // Trigger draft generation for the new idea, then reload state.
              // CS v2 Phase 2 — forward the model id chosen in IntentionForm
              // so the generation run records it on `content_generation_run.model`.
              try {
                const res = await fetch(`/api/admin/content-studio/ideas/${idea.id}/generate`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify(model ? { model } : {}),
                });
                if (res.ok) {
                  const json = (await res.json()) as {
                    drafts?: ContentDraft[];
                    // Backend currently exposes a single generation run inside
                    // the response. Surface its model + cost in the UI (G07).
                    runs?: Array<{ model: string; provider: string; costCents: number }>;
                  };
                  const generated = json.drafts ?? [];
                  const first = generated[0];
                  if (first) {
                    setDrafts((prev) => [...generated, ...prev]);
                    selectDraft(first.id);
                  }
                  if (json.runs && json.runs.length > 0) {
                    const run = json.runs[0]!;
                    setLastTextRun({
                      model: run.model,
                      provider: run.provider,
                      costCents: run.costCents,
                    });
                  } else if (model) {
                    // No run payload from the server yet — best effort UX.
                    setLastTextRun({ model, provider: 'openai', costCents: 0 });
                  }
                }
              } catch {
                // Generation failure is not blocking — user can retry.
              }
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div data-section="generate" style={{ display: 'contents' }}>
          {lastTextRun && variants.length > 0 ? (
            <p
              data-testid="generated-by-badge"
              role="note"
              aria-label="Modèle utilisé pour la génération"
              style={{
                margin: 0,
                fontSize: 11,
                color: 'var(--cs-fg-muted)',
                fontFamily: 'var(--cs-font-mono)',
              }}
            >
              Généré par {lastTextRun.model} · {lastTextRun.provider}
              {lastTextRun.costCents > 0 ? ` · ${lastTextRun.costCents}¢` : ' · gratuit'}
            </p>
          ) : null}
          {variants.length > 0 ? (
            <VariantsCompare
              variants={variants}
              selectedId={draft?.id ?? null}
              onSelect={(v) => {
                selectDraft(v.draft.id);
                upsertDraft(v.draft);
                // CS v2 Phase 5 — auto-trigger brand review so the draft
                // transitions to `needs_review` and the Stepper advances
                // naturally (no `hasMedia + caption` hack).
                void fetch(`/api/admin/content-studio/drafts/${v.draft.id}/review`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                })
                  .then((res) => (res.ok ? res.json() : null))
                  .then((json: { draft?: ContentDraft; review?: unknown } | null) => {
                    if (json?.draft) upsertDraft(json.draft);
                  })
                  .catch(() => {});
              }}
            />
          ) : null}
          </div>
          <div data-section="visual" style={{ display: 'contents' }}>
          <MediaStudio
            draftId={draft?.id ?? ''}
            items={mediaItems}
            selectedMedia={selectedMedia}
            onSelect={(item) => setSelectedMediaId(item?.id ?? null)}
            onUploaded={(item) => {
              setMediaItems((prev) => [item, ...prev.filter((m) => m.id !== item.id)]);
            }}
            format={(draft?.format ?? format) as ContentFormat | undefined}
          />
          {draft ? (
            <CaptionEditor
              draftId={draft.id}
              initialCaption={draft.caption}
              initialHook={draft.hook}
              onChange={(next) => setLivePreview(next)}
            />
          ) : null}
          </div>
        </div>

        <PreviewPane
          platform={platform}
          format={format}
          media={selectedMedia}
          caption={captionForPreview}
          onPlatformChange={(value) => setPlatform(value)}
          onFormatChange={(value) => setFormat(value as PreviewFormat)}
          hasDraft={Boolean(draft)}
          footerActions={
            <ApproveButton
              draft={draft}
              hasMedia={Boolean(selectedMedia)}
              onApproved={(approvedPost: ContentPost) => {
                // CS v2 Phase 5 — push the new post into the context so
                // PublishActionGroup unlocks immediately.
                setPosts((prev) => [
                  approvedPost,
                  ...prev.filter((p) => p.id !== approvedPost.id),
                ]);
                // Reflect the new draft.status (approved) too.
                if (draft) {
                  upsertDraft({ ...draft, status: 'approved' });
                }
              }}
            />
          }
        />
      </div>

      <PublishActionGroup
        postId={post?.id ?? null}
        mockMode={mockMode}
        // CS v2 Phase 7 G12 — visual recap inside the confirm dialogs.
        preview={
          draft
            ? {
                thumbnailUrl: selectedMedia?.thumbnailUrl ?? selectedMedia?.previewUrl ?? null,
                caption: captionForPreview,
                platform,
                format,
                mediaKind: selectedMedia?.kind ?? null,
                mediaPreviewUrl: selectedMedia?.previewUrl ?? null,
                mediaAlt: selectedMedia?.alt ?? null,
                durationSec: selectedMedia?.durationSec ?? null,
                width: selectedMedia?.width ?? null,
                height: selectedMedia?.height ?? null,
              }
            : null
        }
        autosave={{
          status: autosave.status,
          isDirty: autosave.isDirty,
          lastSavedAt: autosave.lastSavedAt,
          error: autosave.error,
          flush: autosave.flush,
        }}
      />
    </div>
  );
}

// re-exports for typing convenience in the page component
export type { ContentFormat, ContentPlatform };
