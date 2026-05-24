/**
 * Unit tests for the v2 StudioContext + composable hooks.
 *
 * Strategy:
 *   - Render `useStudio` / `useDraft` / `useDraftAutosave` inside a
 *     `<StudioProvider>` with `skipInitialFetch` to avoid mount fetch.
 *   - For autosave, pass a stubbed `transport` so we never touch
 *     `global.fetch` and tests stay deterministic with `vi.useFakeTimers()`.
 */

import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ContentDraft, ContentIdea, ContentPost } from '@/lib/content-studio/types';
import {
  StudioProvider,
  useDraft,
  useDraftAutosave,
  useStudio,
} from './StudioContext';

function makeDraft(overrides: Partial<ContentDraft> = {}): ContentDraft {
  return {
    id: 'draft-1',
    briefId: 'brief-1',
    platform: 'instagram',
    format: 'post',
    variantLabel: 'A',
    caption: 'Caption initiale',
    hook: null,
    cta: null,
    altText: null,
    hashtags: [],
    rejectionReason: null,
    parentDraftId: null,
    status: 'needs_review',
    scoreTotal: null,
    editedBy: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeIdea(overrides: Partial<ContentIdea> = {}): ContentIdea {
  return {
    id: 'idea-1',
    campaignId: null,
    pillar: 'rituel',
    objective: 'consideration',
    platform: 'instagram',
    format: 'post',
    prompt: 'Présenter le rituel',
    sourceType: null,
    sourceRef: null,
    rejectionReason: null,
    status: 'idea',
    createdBy: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makePost(overrides: Partial<ContentPost> = {}): ContentPost {
  return {
    id: 'post-1',
    draftId: 'draft-1',
    status: 'approved',
    scheduledAt: null,
    publishedAt: null,
    utm: {},
    approvedBy: null,
    cancelledBy: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function wrapper(initial?: Parameters<typeof StudioProvider>[0]['initial']) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StudioProvider initial={initial ?? { ideas: [], drafts: [], posts: [] }} skipInitialFetch>
        {children}
      </StudioProvider>
    );
  };
}

describe('useStudio', () => {
  it('exposes the expected shape and starts empty when no initial', () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: wrapper({ ideas: [], drafts: [], posts: [] }),
    });
    expect(result.current.ideas).toEqual([]);
    expect(result.current.drafts).toEqual([]);
    expect(result.current.posts).toEqual([]);
    expect(result.current.jobs).toEqual([]);
    expect(result.current.mediaItems).toEqual([]);
    expect(result.current.selectedDraftId).toBeNull();
    expect(typeof result.current.setIdeas).toBe('function');
    expect(typeof result.current.upsertDraft).toBe('function');
    expect(typeof result.current.reload).toBe('function');
  });

  it('hydrates from `initial` and supports selectDraft', () => {
    const ideas = [makeIdea(), makeIdea({ id: 'idea-2' })];
    const drafts = [makeDraft(), makeDraft({ id: 'draft-2' })];
    const { result } = renderHook(() => useStudio(), {
      wrapper: wrapper({ ideas, drafts, posts: [] }),
    });
    expect(result.current.ideas).toHaveLength(2);
    expect(result.current.drafts).toHaveLength(2);
    act(() => result.current.selectDraft('draft-2'));
    expect(result.current.selectedDraftId).toBe('draft-2');
  });

  it('upsertDraft inserts new and replaces existing', () => {
    const initial = [makeDraft(), makeDraft({ id: 'draft-2', caption: 'autre' })];
    const { result } = renderHook(() => useStudio(), {
      wrapper: wrapper({ drafts: initial }),
    });
    act(() => {
      result.current.upsertDraft(makeDraft({ id: 'draft-3', caption: 'tiers' }));
    });
    expect(result.current.drafts).toHaveLength(3);
    act(() => {
      result.current.upsertDraft(makeDraft({ id: 'draft-2', caption: 'modifié' }));
    });
    const updated = result.current.drafts.find((d) => d.id === 'draft-2');
    expect(updated?.caption).toBe('modifié');
    expect(result.current.drafts).toHaveLength(3);
  });

  it('throws when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useStudio())).toThrow(/StudioProvider/);
    spy.mockRestore();
  });
});

describe('useDraft', () => {
  it('returns null when draftId is null', () => {
    const { result } = renderHook(() => useDraft(null), {
      wrapper: wrapper({ drafts: [makeDraft()], posts: [makePost()] }),
    });
    expect(result.current.draft).toBeNull();
    expect(result.current.post).toBeNull();
    expect(result.current.jobs).toEqual([]);
  });

  it('returns the matching draft and post', () => {
    const draft = makeDraft({ id: 'd-abc' });
    const post = makePost({ id: 'p-1', draftId: 'd-abc' });
    const { result } = renderHook(() => useDraft('d-abc'), {
      wrapper: wrapper({ drafts: [draft], posts: [post] }),
    });
    expect(result.current.draft?.id).toBe('d-abc');
    expect(result.current.post?.id).toBe('p-1');
  });
});

describe('useDraftAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle and turns dirty on patch but does not call transport before debounce', async () => {
    const transport = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ draft: makeDraft({ caption: 'serveur' }) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { result } = renderHook(
      () =>
        useDraftAutosave('draft-1', {
          debounceMs: 200,
          transport: transport as unknown as typeof fetch,
        }),
      { wrapper: wrapper({ drafts: [makeDraft()] }) },
    );
    expect(result.current.status).toBe('idle');
    expect(result.current.isDirty).toBe(false);
    act(() => result.current.patch({ caption: 'nouveau' }));
    expect(result.current.isDirty).toBe(true);
    expect(transport).not.toHaveBeenCalled();
  });

  it('debounces a single PATCH call and surfaces "saved" status', async () => {
    const transport = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ draft: makeDraft({ caption: 'serveur' }) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { result } = renderHook(
      () =>
        useDraftAutosave('draft-1', {
          debounceMs: 200,
          transport: transport as unknown as typeof fetch,
        }),
      { wrapper: wrapper({ drafts: [makeDraft()] }) },
    );
    act(() => {
      result.current.patch({ caption: 'a' });
      result.current.patch({ caption: 'ab' });
      result.current.patch({ caption: 'abc' });
    });
    expect(transport).not.toHaveBeenCalled();
    // `runAllTimersAsync` advances fake timers AND awaits the microtask
    // queue settling — needed because `send()` has a `await transport()`
    // followed by `await res.json()` then several setState calls.
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(transport).toHaveBeenCalledTimes(1);
    const callArg = transport.mock.calls[0]?.[0] as string;
    const init = transport.mock.calls[0]?.[1] as RequestInit;
    expect(callArg).toBe('/api/admin/content-studio/drafts/draft-1');
    expect(init.method).toBe('PATCH');
    expect(typeof init.body).toBe('string');
    expect(JSON.parse(init.body as string)).toEqual({ caption: 'abc' });
    expect(result.current.status).toBe('saved');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.lastSavedAt).not.toBeNull();
  });

  it('marks status "error" when transport rejects', async () => {
    const transport = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'boom' } }), { status: 500 }),
    );
    const { result } = renderHook(
      () => useDraftAutosave('draft-1', { debounceMs: 50, transport: transport as unknown as typeof fetch }),
      { wrapper: wrapper({ drafts: [makeDraft()] }) },
    );
    act(() => result.current.patch({ caption: 'oops' }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeTruthy();
  });

  it('flush() sends pending patch immediately without waiting for the debounce', async () => {
    const transport = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ draft: makeDraft() }), { status: 200 }),
    );
    const { result } = renderHook(
      () => useDraftAutosave('draft-1', { debounceMs: 5000, transport: transport as unknown as typeof fetch }),
      { wrapper: wrapper({ drafts: [makeDraft()] }) },
    );
    act(() => result.current.patch({ caption: 'flush-me' }));
    await act(async () => {
      await result.current.flush();
    });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(JSON.parse(transport.mock.calls[0]?.[1]?.body as string)).toEqual({ caption: 'flush-me' });
  });

  it('does nothing when draftId is null', () => {
    const transport = vi.fn() as unknown as typeof fetch;
    const { result } = renderHook(() => useDraftAutosave(null, { transport }), {
      wrapper: wrapper(),
    });
    act(() => result.current.patch({ caption: 'never' }));
    expect(transport).not.toHaveBeenCalled();
  });

  it('PATCH 401 sets status to session_expired', async () => {
    const transport = vi.fn().mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    );
    const { result } = renderHook(
      () => useDraftAutosave('draft-1', { debounceMs: 50, transport: transport as unknown as typeof fetch }),
      { wrapper: wrapper({ drafts: [makeDraft()] }) },
    );
    act(() => result.current.patch({ caption: 'expired' }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current.status).toBe('session_expired');
    expect(result.current.error).toBe('session_expired');
  });
});

describe('StudioProvider rendering', () => {
  it('renders children once mounted', () => {
    const { getByTestId } = render(
      <StudioProvider skipInitialFetch initial={{ drafts: [], ideas: [], posts: [] }}>
        <div data-testid="child">ok</div>
      </StudioProvider>,
    );
    expect(getByTestId('child').textContent).toBe('ok');
  });
});
