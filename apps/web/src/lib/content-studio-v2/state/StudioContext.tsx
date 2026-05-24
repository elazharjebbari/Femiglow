'use client';

/**
 * Content Studio v2 — global state context + composable hooks.
 *
 * Source of truth for the four collections (ideas, drafts, posts, jobs)
 * that drive every v2 mode page. Hydrated on mount from the existing
 * admin REST endpoints (`/api/admin/content-studio/{ideas,drafts,posts,publish-jobs}`)
 * — we deliberately reuse the v1 routes so the v2 module stays
 * backward-compatible during the parallel-life period.
 *
 * Three exported hooks:
 *
 *   useStudio()              full state + setters + reload helpers
 *   useDraft(draftId)        single-draft view (draft + related jobs)
 *   useDraftAutosave(draftId) debounced PATCH /drafts/:id with status indicator
 *
 * Cf. plan-content-studio-v2-2026-05-22.md §3.2 and Phase 3 §3.1/3.5.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type {
  ContentDraft,
  ContentIdea,
  ContentPost,
} from '@/lib/content-studio/types';
import type { SocialPublishJob } from '@/lib/social-publishing/contracts';
import type { StudioV2MediaItem } from '@/lib/content-studio-v2/media/types';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'session_expired';

export interface DraftPatch {
  caption?: string;
  hook?: string | null;
  cta?: string | null;
  altText?: string | null;
  hashtags?: string[];
  mediaId?: string | null;
}

export interface StudioState {
  ideas: ContentIdea[];
  drafts: ContentDraft[];
  posts: ContentPost[];
  jobs: SocialPublishJob[];
  mediaItems: StudioV2MediaItem[];
  selectedDraftId: string | null;
  loading: boolean;
  error: string | null;
}

export interface StudioActions {
  setIdeas: (next: ContentIdea[] | ((prev: ContentIdea[]) => ContentIdea[])) => void;
  setDrafts: (next: ContentDraft[] | ((prev: ContentDraft[]) => ContentDraft[])) => void;
  setPosts: (next: ContentPost[] | ((prev: ContentPost[]) => ContentPost[])) => void;
  setJobs: (next: SocialPublishJob[] | ((prev: SocialPublishJob[]) => SocialPublishJob[])) => void;
  setMediaItems: (
    next: StudioV2MediaItem[] | ((prev: StudioV2MediaItem[]) => StudioV2MediaItem[]),
  ) => void;
  selectDraft: (draftId: string | null) => void;
  upsertDraft: (draft: ContentDraft) => void;
  removeIdea: (id: string) => void;
  reload: () => Promise<void>;
}

export type StudioContextValue = StudioState & StudioActions;

const StudioContext = createContext<StudioContextValue | null>(null);

interface StudioProviderProps {
  children: ReactNode;
  /**
   * Pre-hydrated initial data, when the page can server-render the snapshot.
   * If omitted, the provider fetches on mount.
   */
  initial?: Partial<Pick<StudioState, 'ideas' | 'drafts' | 'posts' | 'jobs' | 'mediaItems' | 'selectedDraftId'>>;
  /**
   * Disable the on-mount network fetch — useful in tests where we wire
   * the state directly via `initial`.
   */
  skipInitialFetch?: boolean;
}

export function StudioProvider({ children, initial, skipInitialFetch = false }: StudioProviderProps) {
  const [ideas, setIdeas] = useState<ContentIdea[]>(initial?.ideas ?? []);
  const [drafts, setDrafts] = useState<ContentDraft[]>(initial?.drafts ?? []);
  const [posts, setPosts] = useState<ContentPost[]>(initial?.posts ?? []);
  const [jobs, setJobs] = useState<SocialPublishJob[]>(initial?.jobs ?? []);
  const [mediaItems, setMediaItems] = useState<StudioV2MediaItem[]>(initial?.mediaItems ?? []);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(initial?.selectedDraftId ?? null);
  const [loading, setLoading] = useState(!skipInitialFetch && !initial);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ideasRes, draftsRes, postsRes] = await Promise.all([
        fetch('/api/admin/content-studio/ideas?limit=100'),
        fetch('/api/admin/content-studio/drafts?limit=100'),
        fetch('/api/admin/content-studio/posts?limit=100'),
      ]);
      if (!ideasRes.ok || !draftsRes.ok || !postsRes.ok) {
        throw new Error('content_studio_v2_hydration_failed');
      }
      const ideasJson = (await ideasRes.json()) as { ideas: ContentIdea[] };
      const draftsJson = (await draftsRes.json()) as { drafts: ContentDraft[] };
      const postsJson = (await postsRes.json()) as { posts: ContentPost[] };
      setIdeas(ideasJson.ideas ?? []);
      setDrafts(draftsJson.drafts ?? []);
      setPosts(postsJson.posts ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de chargement Studio';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (skipInitialFetch || initial) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upsertDraft = useCallback((draft: ContentDraft) => {
    setDrafts((prev) => {
      const idx = prev.findIndex((d) => d.id === draft.id);
      if (idx === -1) return [draft, ...prev];
      const next = prev.slice();
      next[idx] = draft;
      return next;
    });
  }, []);

  const removeIdea = useCallback((id: string) => {
    setIdeas((prev) => prev.filter((idea) => idea.id !== id));
  }, []);

  const selectDraft = useCallback((draftId: string | null) => {
    setSelectedDraftId(draftId);
  }, []);

  const value = useMemo<StudioContextValue>(
    () => ({
      ideas,
      drafts,
      posts,
      jobs,
      mediaItems,
      selectedDraftId,
      loading,
      error,
      setIdeas,
      setDrafts,
      setPosts,
      setJobs,
      setMediaItems,
      selectDraft,
      upsertDraft,
      removeIdea,
      reload,
    }),
    [
      ideas,
      drafts,
      posts,
      jobs,
      mediaItems,
      selectedDraftId,
      loading,
      error,
      selectDraft,
      upsertDraft,
      removeIdea,
      reload,
    ],
  );

  // Expose the context value on window for E2E testing (Playwright).
  useEffect(() => {
    (window as any).__STUDIO_CTX__ = value;
    return () => {
      delete (window as any).__STUDIO_CTX__;
    };
  }, [value]);

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) {
    throw new Error('useStudio must be used inside <StudioProvider>');
  }
  return ctx;
}

export interface DraftView {
  draft: ContentDraft | null;
  jobs: SocialPublishJob[];
  post: ContentPost | null;
}

export function useDraft(draftId: string | null): DraftView {
  const { drafts, jobs, posts } = useStudio();
  return useMemo<DraftView>(() => {
    const draft = draftId ? drafts.find((d) => d.id === draftId) ?? null : null;
    const post = draftId ? posts.find((p) => p.draftId === draftId) ?? null : null;
    const draftJobs = post ? jobs.filter((j) => j.postId === post.id) : [];
    return { draft, post, jobs: draftJobs };
  }, [draftId, drafts, jobs, posts]);
}

export interface DraftAutosaveAPI {
  status: AutosaveStatus;
  lastSavedAt: number | null;
  isDirty: boolean;
  /** Push a partial patch — debounced PATCH /drafts/:id, 1.5s by default. */
  patch: (next: DraftPatch) => void;
  /** Flush any pending debounced patch immediately. */
  flush: () => Promise<void>;
  error: string | null;
}

const AUTOSAVE_DEBOUNCE_MS = 1500;

export function useDraftAutosave(
  draftId: string | null,
  options: { debounceMs?: number; transport?: typeof fetch } = {},
): DraftAutosaveAPI {
  const debounceMs = options.debounceMs ?? AUTOSAVE_DEBOUNCE_MS;
  const transport = options.transport ?? fetch;
  const { upsertDraft } = useStudio();
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingRef = useRef<DraftPatch>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const send = useCallback(async () => {
    if (!draftId) return;
    const body = pendingRef.current;
    if (Object.keys(body).length === 0) return;
    pendingRef.current = {};
    setStatus('saving');
    setError(null);
    try {
      const res = await transport(`/api/admin/content-studio/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        setError('session_expired');
        setStatus('session_expired');
        return;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const json = (await res.json().catch(() => null)) as { draft?: ContentDraft } | null;
      if (json?.draft) upsertDraft(json.draft);
      setStatus('saved');
      setLastSavedAt(Date.now());
      setIsDirty(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Échec de la sauvegarde';
      setError(message);
      setStatus('error');
    }
  }, [draftId, transport, upsertDraft]);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      inFlightRef.current = send();
    }, debounceMs);
  }, [debounceMs, send]);

  const patch = useCallback(
    (next: DraftPatch) => {
      if (!draftId) return;
      pendingRef.current = { ...pendingRef.current, ...next };
      setIsDirty(true);
      schedule();
    },
    [draftId, schedule],
  );

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await send();
  }, [send]);

  // Cleanup on unmount or draft switch.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [draftId]);

  return { status, lastSavedAt, isDirty, patch, flush, error };
}

// Test helpers — not part of the public surface but exported for vitest.
export const __test = {
  AUTOSAVE_DEBOUNCE_MS,
};
