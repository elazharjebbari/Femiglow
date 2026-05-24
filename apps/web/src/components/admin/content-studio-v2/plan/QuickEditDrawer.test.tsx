/**
 * Tests for QuickEditDrawer — slide-out panel for quick post schedule edits.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuickEditDrawer } from './QuickEditDrawer';
import { buildContentDraft, buildContentPost } from '@/test/factories/content-studio';

// Mock sonner to observe toasts
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import { toast } from 'sonner';

describe('QuickEditDrawer', () => {
  const draft = buildContentDraft({
    id: 'draft_qe1',
    caption: 'Caption test quick edit',
    platform: 'instagram',
    format: 'post',
    hashtags: ['#femiglow'],
  });
  const post = buildContentPost({
    id: 'post_qe1',
    draftId: 'draft_qe1',
    scheduledAt: new Date('2026-06-15T10:00:00.000Z'),
  });

  it('renders when open=true with post data', () => {
    render(
      <QuickEditDrawer
        open={true}
        onOpenChange={vi.fn()}
        post={post}
        draft={draft}
      />,
    );
    expect(screen.getByTestId('quick-edit-drawer')).toBeInTheDocument();
    expect(screen.getByText(/Édition rapide/i)).toBeInTheDocument();
    // Draft caption visible
    expect(screen.getByText(/Caption test quick edit/i)).toBeInTheDocument();
    // Platform and format badges
    expect(screen.getByText('instagram')).toBeInTheDocument();
    expect(screen.getByText('post')).toBeInTheDocument();
  });

  it('date input accepts value', () => {
    render(
      <QuickEditDrawer
        open={true}
        onOpenChange={vi.fn()}
        post={post}
        draft={draft}
      />,
    );
    const dateInput = screen.getByTestId('quick-edit-schedule-input');
    fireEvent.change(dateInput, {
      target: { value: '2026-07-01T14:30' },
    });
    expect(dateInput).toHaveValue('2026-07-01T14:30');
  });

  it('close button calls onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    render(
      <QuickEditDrawer
        open={true}
        onOpenChange={onOpenChange}
        post={post}
        draft={draft}
      />,
    );
    const closeBtn = screen.getByRole('button', { name: /Fermer/i });
    fireEvent.click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not render drawer content when open=false', () => {
    render(
      <QuickEditDrawer
        open={false}
        onOpenChange={vi.fn()}
        post={post}
        draft={draft}
      />,
    );
    expect(screen.queryByTestId('quick-edit-drawer')).not.toBeInTheDocument();
  });

  it('save button calls fetcher and shows success toast', async () => {
    const onUpdated = vi.fn();
    const onOpenChange = vi.fn();
    const mockFetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ post: { ...post, scheduledAt: '2026-07-01T14:30:00.000Z' } }),
    });
    render(
      <QuickEditDrawer
        open={true}
        onOpenChange={onOpenChange}
        post={post}
        draft={draft}
        fetcher={mockFetcher}
        onUpdated={onUpdated}
      />,
    );
    const dateInput = screen.getByTestId('quick-edit-schedule-input');
    fireEvent.change(dateInput, {
      target: { value: '2026-07-01T14:30' },
    });
    const saveBtn = screen.getByTestId('quick-edit-save');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockFetcher).toHaveBeenCalledOnce();
    });
    expect(toast.success).toHaveBeenCalledWith('Horaire mis à jour.');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('save button is disabled when no post', () => {
    render(
      <QuickEditDrawer
        open={true}
        onOpenChange={vi.fn()}
        post={null}
        draft={undefined}
      />,
    );
    const saveBtn = screen.getByTestId('quick-edit-save');
    expect(saveBtn).toBeDisabled();
  });

  it('shows hashtags if draft has them', () => {
    render(
      <QuickEditDrawer
        open={true}
        onOpenChange={vi.fn()}
        post={post}
        draft={draft}
      />,
    );
    expect(screen.getByText('#femiglow')).toBeInTheDocument();
  });

  it('"Annuler la publication" visible when post.status === "scheduled"', () => {
    const scheduledPost = buildContentPost({
      id: 'post_sched1',
      draftId: 'draft_qe1',
      status: 'scheduled',
      scheduledAt: new Date('2026-06-15T10:00:00.000Z'),
    });
    render(
      <QuickEditDrawer
        open={true}
        onOpenChange={vi.fn()}
        post={scheduledPost}
        draft={draft}
      />,
    );
    expect(screen.getByTestId('cancel-publication-btn')).toBeInTheDocument();
  });

  it('"Annuler la publication" NOT visible when post.status === "approved"', () => {
    const approvedPost = buildContentPost({
      id: 'post_app1',
      draftId: 'draft_qe1',
      status: 'approved',
    });
    render(
      <QuickEditDrawer
        open={true}
        onOpenChange={vi.fn()}
        post={approvedPost}
        draft={draft}
      />,
    );
    expect(screen.queryByTestId('cancel-publication-btn')).not.toBeInTheDocument();
  });

  it('click cancel → dialog → confirm → fetch called → toast success', async () => {
    const onUpdated = vi.fn();
    const onOpenChange = vi.fn();
    const scheduledPost = buildContentPost({
      id: 'post_sched2',
      draftId: 'draft_qe1',
      status: 'scheduled',
      scheduledAt: new Date('2026-06-15T10:00:00.000Z'),
    });
    const mockFetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    render(
      <QuickEditDrawer
        open={true}
        onOpenChange={onOpenChange}
        post={scheduledPost}
        draft={draft}
        fetcher={mockFetcher}
        onUpdated={onUpdated}
      />,
    );
    fireEvent.click(screen.getByTestId('cancel-publication-btn'));
    await waitFor(() => {
      expect(screen.getByText(/Le post sera retiré du calendrier/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-cancel-publication'));
    await waitFor(() => {
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/admin/content-studio/posts/post_sched2/cancel',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith('Publication annulée.');
    expect(onUpdated).toHaveBeenCalled();
  });
});
