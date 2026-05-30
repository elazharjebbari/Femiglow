/**
 * Tests for PublishActionGroup — publish dropdown + autosave indicator.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishActionGroup } from './PublishActionGroup';
import type { AutosaveStatus } from '@/lib/content-studio-v2/state/StudioContext';

function makeAutosave(overrides: Partial<{
  status: AutosaveStatus;
  isDirty: boolean;
  lastSavedAt: number | null;
  error: string | null;
  flush: () => Promise<void>;
}> = {}) {
  return {
    status: 'idle' as AutosaveStatus,
    isDirty: false,
    lastSavedAt: null,
    error: null,
    flush: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('PublishActionGroup', () => {
  it('Publier button is disabled when postId is null', () => {
    render(
      <PublishActionGroup postId={null} autosave={makeAutosave()} />,
    );
    const publishBtn = screen.getByRole('button', { name: /Options de publication/i });
    expect(publishBtn).toBeDisabled();
  });

  it('Publier button is enabled when postId is provided', () => {
    render(
      <PublishActionGroup postId="post_test1" autosave={makeAutosave()} />,
    );
    const publishBtn = screen.getByRole('button', { name: /Options de publication/i });
    expect(publishBtn).not.toBeDisabled();
  });

  it('shows message when postId is null', () => {
    render(
      <PublishActionGroup postId={null} autosave={makeAutosave()} />,
    );
    expect(
      // CS v2 Phase 6 — wording changed from "Approuvez" to "Validez" to
      // align with the new ApproveButton CTA in PreviewPane.
      screen.getByText(/Validez le draft pour activer la publication/i),
    ).toBeInTheDocument();
  });

  it('shows autosave saving indicator', () => {
    render(
      <PublishActionGroup
        postId="post_test1"
        autosave={makeAutosave({ status: 'saving' })}
      />,
    );
    expect(screen.getByText(/Enregistrement/i)).toBeInTheDocument();
  });

  it('shows autosave error indicator', () => {
    render(
      <PublishActionGroup
        postId="post_test1"
        autosave={makeAutosave({ status: 'error', error: 'Network failed' })}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Échec/i)).toBeInTheDocument();
  });

  it('shows autosave saved indicator', () => {
    render(
      <PublishActionGroup
        postId="post_test1"
        autosave={makeAutosave({ status: 'saved', lastSavedAt: Date.now() })}
      />,
    );
    expect(screen.getByText(/Enregistré/i)).toBeInTheDocument();
  });

  it('disabled prop also disables the publish button', () => {
    render(
      <PublishActionGroup
        postId="post_test1"
        autosave={makeAutosave()}
        disabled
      />,
    );
    const publishBtn = screen.getByRole('button', { name: /Options de publication/i });
    expect(publishBtn).toBeDisabled();
  });

  it('renders the footer with aria-label "Publier"', () => {
    render(
      <PublishActionGroup postId={null} autosave={makeAutosave()} />,
    );
    expect(
      screen.getByRole('contentinfo', { name: /Publier/i }),
    ).toBeInTheDocument();
  });

  // CS v2 Phase 7 G12 — confirm preview.
  describe('preview (G12)', () => {
    async function openPublishNowDialog() {
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Options de publication/i }));
      await user.click(await screen.findByRole('menuitem', { name: /Publier maintenant/i }));
    }

    it('shows thumbnail + truncated caption inside the publish-now dialog', async () => {
      render(
        <PublishActionGroup
          postId="post_1"
          autosave={makeAutosave()}
          preview={{
            thumbnailUrl: '/_media/test.jpg',
            caption: 'X'.repeat(200),
            platform: 'instagram',
            format: 'reel',
          }}
        />,
      );
      await openPublishNowDialog();
      const preview = screen.getByTestId('publish-confirm-preview');
      expect(preview).toBeInTheDocument();
      // The caption (140 X + ellipsis) sits at the start of the preview block.
      expect(preview).toHaveTextContent(/X{140}…/);
      expect(screen.getByTestId('publish-confirm-platform')).toHaveTextContent(/instagram/i);
      expect(screen.getByTestId('publish-confirm-format')).toHaveTextContent(/reel/i);
    });

    it('shows a dashed placeholder when no thumbnail is available', async () => {
      render(
        <PublishActionGroup
          postId="post_1"
          autosave={makeAutosave()}
          preview={{
            thumbnailUrl: null,
            caption: 'short caption',
            platform: 'instagram',
            format: 'post',
          }}
        />,
      );
      await openPublishNowDialog();
      const preview = screen.getByTestId('publish-confirm-preview');
      expect(preview).toBeInTheDocument();
      expect(preview.querySelector('img')).toBeNull();
    });

    it('skips the preview block entirely when preview prop is null', async () => {
      render(
        <PublishActionGroup postId="post_1" autosave={makeAutosave()} preview={null} />,
      );
      await openPublishNowDialog();
      expect(screen.queryByTestId('publish-confirm-preview')).toBeNull();
    });

    it('shows the "Mode mock" tag inside the preview when mockMode is true', async () => {
      render(
        <PublishActionGroup
          postId="post_1"
          mockMode
          autosave={makeAutosave()}
          preview={{
            thumbnailUrl: null,
            caption: 'short',
            platform: 'instagram',
            format: 'post',
          }}
        />,
      );
      await openPublishNowDialog();
      expect(screen.getByTestId('publish-confirm-preview')).toHaveTextContent(/Mode mock/i);
    });

    it('renders mini VideoPlayer when mediaKind=video + mediaPreviewUrl', async () => {
      render(
        <PublishActionGroup
          postId="post_1"
          autosave={makeAutosave()}
          preview={{
            thumbnailUrl: '/poster.jpg',
            caption: 'reel caption',
            platform: 'instagram',
            format: 'reel',
            mediaKind: 'video',
            mediaPreviewUrl: '/video.mp4',
            mediaAlt: 'reel',
            durationSec: 5,
            width: 1080,
            height: 1920,
          }}
        />,
      );
      await openPublishNowDialog();
      const preview = screen.getByTestId('publish-confirm-preview');
      // mini player should be present
      expect(preview.querySelector('[data-cs-video-player]')).not.toBeNull();
      // video src should match the mediaPreviewUrl
      const video = preview.querySelector('video');
      expect(video?.getAttribute('src')).toBe('/video.mp4');
      // chrome should be hidden (controls=none)
      expect(preview.querySelector('[data-cs-video-badge]')).toBeNull();
    });

    it('renders metadata line "Vidéo · 0:05 · 1080×1920" when video', async () => {
      render(
        <PublishActionGroup
          postId="post_1"
          autosave={makeAutosave()}
          preview={{
            thumbnailUrl: '/poster.jpg',
            caption: 'reel caption',
            platform: 'instagram',
            format: 'reel',
            mediaKind: 'video',
            mediaPreviewUrl: '/video.mp4',
            durationSec: 5,
            width: 1080,
            height: 1920,
          }}
        />,
      );
      await openPublishNowDialog();
      const meta = screen.getByTestId('publish-confirm-media-meta');
      expect(meta).toHaveTextContent(/Vidéo/);
      expect(meta).toHaveTextContent(/0:05/);
      expect(meta).toHaveTextContent(/1080×1920/);
    });

    it('renders metadata line "Image · 1024×1536" when image (no duration)', async () => {
      render(
        <PublishActionGroup
          postId="post_1"
          autosave={makeAutosave()}
          preview={{
            thumbnailUrl: '/thumb.jpg',
            caption: 'post caption',
            platform: 'instagram',
            format: 'post',
            mediaKind: 'image',
            mediaPreviewUrl: '/preview.jpg',
            width: 1024,
            height: 1536,
          }}
        />,
      );
      await openPublishNowDialog();
      const meta = screen.getByTestId('publish-confirm-media-meta');
      expect(meta).toHaveTextContent(/Image/);
      expect(meta).not.toHaveTextContent(/0:0[0-9]/);
      expect(meta).toHaveTextContent(/1024×1536/);
    });

    it('renders image (not video) when mediaKind=image', async () => {
      render(
        <PublishActionGroup
          postId="post_1"
          autosave={makeAutosave()}
          preview={{
            thumbnailUrl: '/thumb.jpg',
            caption: 'post',
            platform: 'instagram',
            format: 'post',
            mediaKind: 'image',
            mediaPreviewUrl: '/preview.jpg',
          }}
        />,
      );
      await openPublishNowDialog();
      const preview = screen.getByTestId('publish-confirm-preview');
      expect(preview.querySelector('[data-cs-video-player]')).toBeNull();
      expect(preview.querySelector('img')).not.toBeNull();
    });
  });
});
