import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApproveButton } from './ApproveButton';
import type { ContentDraft, ContentPost } from '@/lib/content-studio/types';

function buildDraft(over: Partial<ContentDraft> = {}): ContentDraft {
  return {
    id: 'draft_1',
    briefId: 'brief_1',
    platform: 'instagram',
    format: 'reel',
    variantLabel: 'A',
    caption: 'Une caption non vide.',
    hook: 'Un hook accrocheur.',
    cta: 'Découvrir le rituel',
    altText: 'Visuel skincare',
    hashtags: ['#femiglow'],
    status: 'needs_review',
    rejectionReason: null,
    parentDraftId: null,
    scoreTotal: 85,
    editedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as ContentDraft;
}

describe('ApproveButton', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        post: {
          id: 'post_1',
          draftId: 'draft_1',
          status: 'approved',
        } as ContentPost,
      }),
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('disabled when draft is null', () => {
    render(<ApproveButton draft={null} hasMedia={false} onApproved={vi.fn()} />);
    expect(screen.getByTestId('approve-draft-button')).toBeDisabled();
  });

  it('disabled when no media attached', () => {
    render(<ApproveButton draft={buildDraft()} hasMedia={false} onApproved={vi.fn()} />);
    const btn = screen.getByTestId('approve-draft-button');
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('title')).toMatch(/Attachez un visuel/i);
  });

  it('disabled when caption is empty', () => {
    render(
      <ApproveButton
        draft={buildDraft({ caption: '   ' })}
        hasMedia
        onApproved={vi.fn()}
      />,
    );
    const btn = screen.getByTestId('approve-draft-button');
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('title')).toMatch(/Ajoutez une caption/i);
  });

  it('disabled when brand review is blocked', () => {
    render(
      <ApproveButton draft={buildDraft()} hasMedia brandBlocked onApproved={vi.fn()} />,
    );
    const btn = screen.getByTestId('approve-draft-button');
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('title')).toMatch(/Brand review/i);
  });

  it('disabled when already approved', () => {
    render(
      <ApproveButton
        draft={buildDraft({ status: 'approved' })}
        hasMedia
        onApproved={vi.fn()}
      />,
    );
    expect(screen.getByTestId('approve-draft-button')).toBeDisabled();
  });

  it('enabled when all preconditions met', () => {
    render(<ApproveButton draft={buildDraft()} hasMedia onApproved={vi.fn()} />);
    expect(screen.getByTestId('approve-draft-button')).not.toBeDisabled();
  });

  it('calls POST /drafts/:id/approve on click', async () => {
    render(<ApproveButton draft={buildDraft()} hasMedia onApproved={vi.fn()} />);
    fireEvent.click(screen.getByTestId('approve-draft-button'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/content-studio/drafts/draft_1/approve',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('fires onApproved with the returned post', async () => {
    const onApproved = vi.fn();
    render(<ApproveButton draft={buildDraft()} hasMedia onApproved={onApproved} />);
    fireEvent.click(screen.getByTestId('approve-draft-button'));
    await waitFor(() => {
      expect(onApproved).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'post_1', draftId: 'draft_1' }),
      );
    });
  });

  it('does not call onApproved when the API returns 409', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: { code: 'brand_review_blocked', message: 'Bloqué' } }),
    })) as unknown as typeof fetch;
    const onApproved = vi.fn();
    render(<ApproveButton draft={buildDraft()} hasMedia onApproved={onApproved} />);
    fireEvent.click(screen.getByTestId('approve-draft-button'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    expect(onApproved).not.toHaveBeenCalled();
  });

  it('does not call onApproved when the API rejects (network error)', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    const onApproved = vi.fn();
    render(<ApproveButton draft={buildDraft()} hasMedia onApproved={onApproved} />);
    fireEvent.click(screen.getByTestId('approve-draft-button'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    expect(onApproved).not.toHaveBeenCalled();
  });
});
