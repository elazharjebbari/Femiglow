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
import type { ContentDraft, ContentFormat, ContentIdea, ContentPlatform } from '@/lib/content-studio/types';
import type { StudioV2MediaItem } from '@/lib/content-studio-v2/media/types';
import { StudioProvider, useDraftAutosave, useStudio } from '@/lib/content-studio-v2/state/StudioContext';
import type { PreviewFormat, PreviewPlatform } from '@/components/admin/content-studio-v2/media';
import { Stepper } from './Stepper';
import { IntentionForm } from './IntentionForm';
import { VariantsCompare } from './VariantsCompare';
import { CaptionEditor } from './CaptionEditor';
import { MediaStudio } from './MediaStudio';
import { PreviewPane } from './PreviewPane';
import { PublishActionGroup } from './PublishActionGroup';

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
  const { drafts, posts, mediaItems, setMediaItems, selectedDraftId, selectDraft, upsertDraft } =
    useStudio();

  const [platform, setPlatform] = useState<PreviewPlatform>('instagram');
  const [format, setFormat] = useState<PreviewFormat>('post');
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [livePreview, setLivePreview] = useState<{ caption: string; hook: string | null } | null>(
    null,
  );

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
      <Stepper
        draft={draft}
        hasMedia={Boolean(selectedMediaId)}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 280px) minmax(0, 1fr) minmax(320px, 380px)',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
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
            onCreated={(idea) => {
              // After creating an idea, propagate platform+format hints to the preview.
              setPlatform(idea.platform as PreviewPlatform);
              setFormat(idea.format as PreviewFormat);
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {variants.length > 0 ? (
            <VariantsCompare
              variants={variants}
              selectedId={draft?.id ?? null}
              onSelect={(v) => {
                selectDraft(v.draft.id);
                upsertDraft(v.draft);
              }}
            />
          ) : null}
          <MediaStudio
            draftId={draft?.id ?? ''}
            items={mediaItems}
            selectedMedia={selectedMedia}
            onSelect={(item) => setSelectedMediaId(item?.id ?? null)}
            onUploaded={(item) => {
              setMediaItems((prev) => [item, ...prev.filter((m) => m.id !== item.id)]);
            }}
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

        <PreviewPane
          platform={platform}
          format={format}
          media={selectedMedia}
          caption={captionForPreview}
          onPlatformChange={(value) => setPlatform(value)}
          onFormatChange={(value) => setFormat(value as PreviewFormat)}
        />
      </div>

      <PublishActionGroup
        postId={post?.id ?? null}
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
