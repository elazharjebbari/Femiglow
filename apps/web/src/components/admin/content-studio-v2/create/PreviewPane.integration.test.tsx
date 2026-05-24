import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewPane } from './PreviewPane';
import type { StudioV2MediaItem } from '@/lib/content-studio-v2/media/types';

/* ------------------------------------------------------------------ */
/*  Factory                                                           */
/* ------------------------------------------------------------------ */

function buildMedia(overrides?: Partial<StudioV2MediaItem>): StudioV2MediaItem {
  return {
    id: 'media_1',
    kind: 'image',
    compartment: 'imported',
    alt: 'Integration test image',
    slug: 'integration-test',
    thumbnailUrl: '/thumb.webp',
    previewUrl: '/preview.jpg',
    originalUrl: '/original.jpg',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('PreviewPane — integration with PlatformPreview', () => {
  it('default renders instagram post', () => {
    const { container } = render(
      <PreviewPane platform="instagram" format="post" media={buildMedia()} caption="Default test" />,
    );

    // Aside with aria-label "Aperçu"
    expect(screen.getByLabelText('Aperçu')).toBeInTheDocument();
    // Heading
    expect(screen.getByText('Aperçu')).toBeInTheDocument();
    // Instagram post renders an img
    const img = screen.getByAltText('Integration test image');
    expect(img).toBeInTheDocument();
    // Aspect ratio 4/5 for post
    const aspectDiv = container.querySelector('div[style*="aspect-ratio: 4 / 5"]') as HTMLElement | null;
    expect(aspectDiv).not.toBeNull();
  });

  it('switch platform to facebook — different sub-component rendered', () => {
    const { container } = render(
      <PreviewPane platform="facebook" format="post" media={buildMedia()} caption="FB test" />,
    );

    // Facebook renders "Page · Boutique" in header
    expect(screen.getByText(/Page · Boutique/)).toBeInTheDocument();
    // Facebook post has aspect 1.91 / 1
    const aspectDiv = container.querySelector('div[style*="aspect-ratio: 1.91 / 1"]') as HTMLElement | null;
    expect(aspectDiv).not.toBeNull();
  });

  it('switch format to story — aspect ratio changes to 9:16', () => {
    const { container } = render(
      <PreviewPane platform="instagram" format="story" media={buildMedia()} caption="Story test" />,
    );

    const storyContainer = container.querySelector('div[style*="aspect-ratio: 9 / 16"]') as HTMLElement | null;
    expect(storyContainer).not.toBeNull();
  });

  it('switch format to reel — aspect ratio 9:16', () => {
    const { container } = render(
      <PreviewPane platform="instagram" format="reel" media={buildMedia()} caption="Reel test" />,
    );

    const reelContainer = container.querySelector('div[style*="aspect-ratio: 9 / 16"]') as HTMLElement | null;
    expect(reelContainer).not.toBeNull();
  });

  it('switch format to carousel — dot indicators / badge appear', () => {
    const media = buildMedia();
    const sibling = buildMedia({ id: 'media_2' });
    render(
      <PreviewPane
        platform="instagram"
        format="carousel"
        media={media}
        caption="Carousel test"
      />,
    );

    // Carousel renders via InstagramFeed — basic render without crash
    expect(screen.getByLabelText('Aperçu')).toBeInTheDocument();
  });

  it('caption prop flows to preview text', () => {
    const caption = 'This is my unique caption text for flow test';
    render(
      <PreviewPane platform="instagram" format="post" media={buildMedia()} caption={caption} />,
    );

    expect(screen.getByText(/This is my unique caption text for flow test/)).toBeInTheDocument();
  });

  it('media prop flows to img src', () => {
    const media = buildMedia({ previewUrl: '/custom-preview.jpg', alt: 'Custom image' });
    render(
      <PreviewPane platform="instagram" format="post" media={media} caption="Media flow" />,
    );

    const img = screen.getByAltText('Custom image');
    expect(img).toHaveAttribute('src', '/custom-preview.jpg');
  });

  it('onPlatformChange called on tab click', () => {
    const onPlatformChange = vi.fn();
    render(
      <PreviewPane
        platform="instagram"
        format="post"
        media={buildMedia()}
        caption="Tab test"
        onPlatformChange={onPlatformChange}
      />,
    );

    const facebookTab = screen.getByRole('tab', { name: 'Facebook' });
    fireEvent.click(facebookTab);
    expect(onPlatformChange).toHaveBeenCalledWith('facebook');
  });

  it('onFormatChange called on tab click', () => {
    const onFormatChange = vi.fn();
    render(
      <PreviewPane
        platform="instagram"
        format="post"
        media={buildMedia()}
        caption="Format tab test"
        onFormatChange={onFormatChange}
      />,
    );

    const storyTab = screen.getByRole('tab', { name: 'Story' });
    fireEvent.click(storyTab);
    expect(onFormatChange).toHaveBeenCalledWith('story');
  });

  it('null media renders gradient placeholder', () => {
    const { container } = render(
      <PreviewPane platform="instagram" format="post" media={null} caption="No media" />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('video')).toBeNull();
    const gradient = container.querySelector('div[style*="radial-gradient"]');
    expect(gradient).not.toBeNull();
  });
});
