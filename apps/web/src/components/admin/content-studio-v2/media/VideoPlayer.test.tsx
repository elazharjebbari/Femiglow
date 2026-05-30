/**
 * Tests for VideoPlayer — overlay video chrome (badge VIDÉO, duration, play/pause,
 * mute toggle, loop indicator).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { formatDuration, VideoPlayer } from './VideoPlayer';
import type { StudioV2MediaItem } from '@/lib/content-studio-v2/media/types';

afterEach(() => vi.clearAllMocks());

const baseVideo: StudioV2MediaItem = {
  id: 'media_video_1',
  kind: 'video',
  compartment: 'ai_generated',
  alt: 'Test video',
  slug: 'media_video_1',
  thumbnailUrl: '/poster.jpg',
  previewUrl: '/test.mp4',
  originalUrl: '/test.mp4',
  durationSec: 5,
  width: 1080,
  height: 1920,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('formatDuration', () => {
  it('formats 0:05 for 5 seconds', () => {
    expect(formatDuration(5)).toBe('0:05');
  });

  it('formats 1:23 for 83 seconds', () => {
    expect(formatDuration(83)).toBe('1:23');
  });

  it('formats 0:00 for null', () => {
    expect(formatDuration(null)).toBe('0:00');
  });

  it('formats 0:00 for undefined', () => {
    expect(formatDuration(undefined)).toBe('0:00');
  });

  it('formats 0:00 for negative', () => {
    expect(formatDuration(-5)).toBe('0:00');
  });

  it('rounds fractional seconds', () => {
    expect(formatDuration(4.7)).toBe('0:05');
  });
});

describe('VideoPlayer', () => {
  it('renders a <video> element with the preview URL', () => {
    const { container } = render(<VideoPlayer media={baseVideo} />);
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('/test.mp4');
    expect(video?.getAttribute('poster')).toBe('/poster.jpg');
  });

  it('defaults to autoplay + muted + loop + playsInline', () => {
    const { container } = render(<VideoPlayer media={baseVideo} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.autoplay).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.hasAttribute('playsinline')).toBe(true);
  });

  it('renders the VIDÉO badge with formatted duration', () => {
    const { container } = render(<VideoPlayer media={baseVideo} />);
    const badge = container.querySelector('[data-cs-video-badge]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toMatch(/VIDÉO/);
    expect(badge?.textContent).toMatch(/0:05/);
  });

  it('renders the loop indicator when loop=true', () => {
    const { container } = render(<VideoPlayer media={baseVideo} loop />);
    expect(container.querySelector('[data-cs-video-loop-indicator]')).not.toBeNull();
  });

  it('hides the loop indicator when loop=false', () => {
    const { container } = render(<VideoPlayer media={baseVideo} loop={false} />);
    expect(container.querySelector('[data-cs-video-loop-indicator]')).toBeNull();
  });

  it('shows the play/pause and mute buttons by default (controls=auto, not playing yet)', () => {
    render(<VideoPlayer media={baseVideo} controls="auto" autoPlay={false} />);
    expect(screen.getByLabelText(/Lire la vidéo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Activer le son|Couper le son/i)).toBeInTheDocument();
  });

  it('hides all chrome when controls=none', () => {
    const { container } = render(<VideoPlayer media={baseVideo} controls="none" />);
    expect(container.querySelector('[data-cs-video-badge]')).toBeNull();
    expect(container.querySelector('[data-cs-video-toggle-play]')).toBeNull();
    expect(container.querySelector('[data-cs-video-toggle-mute]')).toBeNull();
  });

  it('always shows chrome when controls=always', () => {
    const { container } = render(<VideoPlayer media={baseVideo} controls="always" />);
    expect(container.querySelector('[data-cs-video-toggle-play]')).not.toBeNull();
    expect(container.querySelector('[data-cs-video-toggle-mute]')).not.toBeNull();
  });

  it('click mute toggle flips the video muted state', () => {
    const { container } = render(<VideoPlayer media={baseVideo} controls="always" />);
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.muted).toBe(true);
    fireEvent.click(screen.getByLabelText(/Activer le son/i));
    expect(video.muted).toBe(false);
  });

  it('click play toggle calls video.play() when paused', () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined);
    render(<VideoPlayer media={baseVideo} controls="always" autoPlay={false} />);
    fireEvent.click(screen.getByLabelText(/Lire la vidéo/i));
    expect(playSpy).toHaveBeenCalled();
    playSpy.mockRestore();
  });

  it('falls back to "0:00" when durationSec is missing', () => {
    const { container } = render(
      <VideoPlayer media={{ ...baseVideo, durationSec: null }} />,
    );
    const badge = container.querySelector('[data-cs-video-badge]');
    expect(badge?.textContent).toMatch(/0:00/);
  });

  it('compact mode keeps the same structure with smaller padding', () => {
    const { container } = render(
      <VideoPlayer media={baseVideo} compact controls="always" />,
    );
    expect(container.querySelector('[data-cs-video-badge]')).not.toBeNull();
    expect(container.querySelector('[data-cs-video-toggle-play]')).not.toBeNull();
  });

  it('respects media.alt as aria-label on the <video> element', () => {
    const { container } = render(
      <VideoPlayer media={{ ...baseVideo, alt: 'Reel saumon ambiance' }} />,
    );
    const video = container.querySelector('video');
    expect(video?.getAttribute('aria-label')).toBe('Reel saumon ambiance');
  });
});
