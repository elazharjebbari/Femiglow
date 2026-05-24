/**
 * Tests for PreviewPane — platform/format selector + delegated PlatformPreview.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewPane } from './PreviewPane';
import type { StudioV2MediaItem } from '@/lib/content-studio-v2/media/types';

describe('PreviewPane', () => {
  it('renders the platform tab row with Instagram and Facebook', () => {
    render(
      <PreviewPane platform="instagram" format="post" media={null} caption="" />,
    );
    const tabs = screen.getAllByRole('tab');
    const labels = tabs.map((t) => t.textContent);
    expect(labels).toContain('Instagram');
    expect(labels).toContain('Facebook');
  });

  it('switching platform calls onPlatformChange', () => {
    const onPlatformChange = vi.fn();
    render(
      <PreviewPane
        platform="instagram"
        format="post"
        media={null}
        caption=""
        onPlatformChange={onPlatformChange}
      />,
    );
    const fbTab = screen.getByRole('tab', { name: /Facebook/i });
    fireEvent.click(fbTab);
    expect(onPlatformChange).toHaveBeenCalledWith('facebook');
  });

  it('caption text appears in preview', () => {
    render(
      <PreviewPane
        platform="instagram"
        format="post"
        media={null}
        caption="Mon texte de preview"
      />,
    );
    expect(screen.getByText(/Mon texte de preview/)).toBeInTheDocument();
  });

  it('media image appears when provided', () => {
    const media: StudioV2MediaItem = {
      id: 'media1',
      kind: 'image',
      compartment: 'imported',
      alt: 'Visuel test',
      slug: 'media1',
      thumbnailUrl: null,
      previewUrl: '/test-preview.webp',
      originalUrl: '/test-original.png',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    render(
      <PreviewPane
        platform="instagram"
        format="post"
        media={media}
        caption="Caption avec media"
      />,
    );
    const img = screen.getByRole('img', { name: /Visuel test/i });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/test-preview.webp');
  });

  it('renders format tab row with 4 format options', () => {
    render(
      <PreviewPane platform="instagram" format="post" media={null} caption="" />,
    );
    const tabs = screen.getAllByRole('tab');
    const labels = tabs.map((t) => t.textContent);
    expect(labels).toContain('Post');
    expect(labels).toContain('Story');
    expect(labels).toContain('Reel');
    expect(labels).toContain('Carousel');
  });

  it('active platform tab has aria-selected=true', () => {
    render(
      <PreviewPane platform="instagram" format="post" media={null} caption="" />,
    );
    const igTab = screen.getByRole('tab', { name: /Instagram/i });
    expect(igTab).toHaveAttribute('aria-selected', 'true');
    const fbTab = screen.getByRole('tab', { name: /Facebook/i });
    expect(fbTab).toHaveAttribute('aria-selected', 'false');
  });

  it('renders aside with aria-label "Aperçu"', () => {
    render(
      <PreviewPane platform="instagram" format="post" media={null} caption="" />,
    );
    expect(
      screen.getByRole('complementary', { name: /Aperçu/i }),
    ).toBeInTheDocument();
  });
});
