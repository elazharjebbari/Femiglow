import { describe, expect, it } from 'vitest';
import { PLATFORM_SPECS } from './platform-specs';

describe('PLATFORM_SPECS', () => {
  it('has instagram key', () => {
    expect(PLATFORM_SPECS).toHaveProperty('instagram');
    expect(PLATFORM_SPECS.instagram).toHaveProperty('feed');
    expect(PLATFORM_SPECS.instagram).toHaveProperty('story');
    expect(PLATFORM_SPECS.instagram).toHaveProperty('reel');
    expect(PLATFORM_SPECS.instagram).toHaveProperty('carousel');
  });

  it('Instagram feed has width 1080, height 1080', () => {
    expect(PLATFORM_SPECS.instagram.feed.width).toBe(1080);
    expect(PLATFORM_SPECS.instagram.feed.height).toBe(1080);
    expect(PLATFORM_SPECS.instagram.feed.aspectRatio).toBe('1:1');
  });

  it('Instagram story has 9:16 aspect ratio (1080x1920)', () => {
    expect(PLATFORM_SPECS.instagram.story.width).toBe(1080);
    expect(PLATFORM_SPECS.instagram.story.height).toBe(1920);
    expect(PLATFORM_SPECS.instagram.story.aspectRatio).toBe('9:16');
  });

  it('Instagram reel matches story dimensions', () => {
    expect(PLATFORM_SPECS.instagram.reel.width).toBe(PLATFORM_SPECS.instagram.story.width);
    expect(PLATFORM_SPECS.instagram.reel.height).toBe(PLATFORM_SPECS.instagram.story.height);
    expect(PLATFORM_SPECS.instagram.reel.aspectRatio).toBe(PLATFORM_SPECS.instagram.story.aspectRatio);
  });

  it('Facebook feed exists', () => {
    expect(PLATFORM_SPECS).toHaveProperty('facebook');
    expect(PLATFORM_SPECS.facebook).toHaveProperty('feed');
    expect(PLATFORM_SPECS.facebook.feed.width).toBe(1200);
    expect(PLATFORM_SPECS.facebook.feed.height).toBe(1200);
    expect(PLATFORM_SPECS.facebook.feed.aspectRatio).toBe('1:1');
  });

  it('TikTok video has 9:16 ratio', () => {
    expect(PLATFORM_SPECS).toHaveProperty('tiktok');
    expect(PLATFORM_SPECS.tiktok.video.aspectRatio).toBe('9:16');
    expect(PLATFORM_SPECS.tiktok.video.width).toBe(1080);
    expect(PLATFORM_SPECS.tiktok.video.height).toBe(1920);
  });

  it('Pinterest pin has 2:3 ratio', () => {
    expect(PLATFORM_SPECS).toHaveProperty('pinterest');
    expect(PLATFORM_SPECS.pinterest.pin.aspectRatio).toBe('2:3');
    expect(PLATFORM_SPECS.pinterest.pin.width).toBe(1000);
    expect(PLATFORM_SPECS.pinterest.pin.height).toBe(1500);
  });

  it('YouTube shorts has 9:16 ratio', () => {
    expect(PLATFORM_SPECS).toHaveProperty('youtube');
    expect(PLATFORM_SPECS.youtube.shorts.aspectRatio).toBe('9:16');
    expect(PLATFORM_SPECS.youtube.shorts.width).toBe(1080);
    expect(PLATFORM_SPECS.youtube.shorts.height).toBe(1920);
    expect(PLATFORM_SPECS.youtube.shorts.maxDurationSeconds).toBe(60);
  });
});
