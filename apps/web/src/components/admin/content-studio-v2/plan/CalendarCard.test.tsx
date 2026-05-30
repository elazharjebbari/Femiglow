/**
 * CalendarCard tests (F30 partial).
 *
 * Couvre rendu badges, thumbnails, pillar dot, hooks dnd-kit (via DndContext
 * wrapper), interactions double-click.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { CalendarCard } from './CalendarCard';
import type {
  ContentDraft,
  ContentPost,
  ContentPostizDelivery,
} from '@/lib/content-studio/types';
import type { CalendarMediaEntry } from './types';

function withDnd(node: React.ReactNode) {
  return <DndContext>{node}</DndContext>;
}

function makePost(over: Partial<ContentPost> = {}): ContentPost {
  return {
    id: 'post_1',
    draftId: 'draft_1',
    status: 'scheduled',
    scheduledAt: new Date('2026-05-28T14:00:00Z'),
    publishedAt: null,
    utm: null,
    approvedBy: 'admin',
    cancelledBy: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as ContentPost;
}

function makeDraft(over: Partial<ContentDraft> = {}): ContentDraft {
  return {
    id: 'draft_1',
    briefId: 'brief_1',
    platform: 'instagram',
    format: 'post',
    variantLabel: 'A',
    caption: 'Caption',
    hook: 'Hook accrocheur',
    cta: 'Découvrir',
    altText: 'alt',
    hashtags: [],
    status: 'approved',
    rejectionReason: null,
    parentDraftId: null,
    scoreTotal: 80,
    editedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as ContentDraft;
}

describe('CalendarCard', () => {
  it('renders hook text as title', () => {
    render(withDnd(<CalendarCard post={makePost()} draft={makeDraft()} media={undefined} latestDelivery={null} pillar="rituel" />));
    expect(screen.getByText('Hook accrocheur')).toBeVisible();
  });

  it('falls back to variantLabel when no hook', () => {
    render(
      withDnd(
        <CalendarCard
          post={makePost()}
          draft={makeDraft({ hook: null })}
          media={undefined}
          latestDelivery={null}
          pillar="rituel"
        />,
      ),
    );
    expect(screen.getByText('A')).toBeVisible();
  });

  it('renders status badge with correct text', () => {
    render(
      withDnd(
        <CalendarCard post={makePost({ status: 'published' })} draft={makeDraft()} media={undefined} latestDelivery={null} pillar="rituel" />,
      ),
    );
    expect(screen.getByText('published')).toBeVisible();
  });

  it('renders failed delivery badge when delivery failed', () => {
    const delivery: ContentPostizDelivery = {
      id: 'del_1',
      postId: 'post_1',
      integrationId: 'int_1',
      postizPostId: null,
      status: 'failed',
      request: {},
      response: null,
      attemptCount: 1,
      lastError: 'Provider down',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ContentPostizDelivery;
    render(
      withDnd(
        <CalendarCard post={makePost()} draft={makeDraft()} media={undefined} latestDelivery={delivery} pillar="rituel" />,
      ),
    );
    expect(screen.getByText(/postiz failed/i)).toBeVisible();
  });

  it('shows scheduled hour formatted FR', () => {
    render(
      withDnd(
        <CalendarCard
          post={makePost({ scheduledAt: new Date('2026-05-28T14:30:00') })}
          draft={makeDraft()}
          media={undefined}
          latestDelivery={null}
          pillar="rituel"
        />,
      ),
    );
    // Hour formatted in FR locale ("14:30")
    expect(screen.getByText(/14:30/)).toBeVisible();
  });

  it('shows ImageOff icon when no media', () => {
    const { container } = render(
      withDnd(
        <CalendarCard post={makePost()} draft={makeDraft()} media={undefined} latestDelivery={null} pillar="rituel" />,
      ),
    );
    // SVG icon for ImageOff has class 'lucide-image-off'
    expect(container.querySelector('.lucide-image-off')).toBeTruthy();
  });

  it('shows media preview img when image media', () => {
    const media: CalendarMediaEntry = {
      mediaId: 'm1',
      kind: 'image',
      previewUrl: 'https://example.com/img.jpg',
      thumbnailUrl: null,
      alt: 'Alt text',
    };
    const { container } = render(
      withDnd(
        <CalendarCard post={makePost()} draft={makeDraft()} media={media} latestDelivery={null} pillar="rituel" />,
      ),
    );
    const img = container.querySelector('img') as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img!.src).toBe('https://example.com/img.jpg');
  });

  it('shows play icon overlay for video media', () => {
    const media: CalendarMediaEntry = {
      mediaId: 'm1',
      kind: 'video',
      previewUrl: 'https://example.com/vid.mp4',
      thumbnailUrl: 'https://example.com/poster.jpg',
      alt: '',
    };
    const { container } = render(
      withDnd(
        <CalendarCard post={makePost()} draft={makeDraft()} media={media} latestDelivery={null} pillar="rituel" />,
      ),
    );
    expect(container.querySelector('.lucide-play')).toBeTruthy();
  });

  it('renders platform · format meta in full variant', () => {
    render(
      withDnd(
        <CalendarCard
          post={makePost()}
          draft={makeDraft({ platform: 'facebook', format: 'reel' })}
          media={undefined}
          latestDelivery={null}
          pillar="rituel"
          variant="full"
        />,
      ),
    );
    expect(screen.getByText(/facebook.*reel/)).toBeVisible();
  });

  it('hides meta in mini variant', () => {
    render(
      withDnd(
        <CalendarCard
          post={makePost()}
          draft={makeDraft({ platform: 'facebook', format: 'reel' })}
          media={undefined}
          latestDelivery={null}
          pillar="rituel"
          variant="mini"
        />,
      ),
    );
    expect(screen.queryByText(/facebook.*reel/)).toBeNull();
  });

  it('fires onDoubleClick callback', () => {
    const onDoubleClick = vi.fn();
    render(
      withDnd(
        <CalendarCard
          post={makePost()}
          draft={makeDraft()}
          media={undefined}
          latestDelivery={null}
          pillar="rituel"
          onDoubleClick={onDoubleClick}
        />,
      ),
    );
    fireEvent.doubleClick(screen.getByTestId('calendar-card-post_1'));
    expect(onDoubleClick).toHaveBeenCalledWith('post_1');
  });
});
