import { describe, expect, it } from 'vitest';

import {
  applyPlatformCaps,
  PLATFORM_CAPS,
  type MediaItem,
} from './platform-caps';

function makeImage(id: string, mime = 'image/jpeg', sizeBytes?: number): MediaItem {
  return { id, url: `https://example.com/${id}.jpg`, mimeType: mime, fileSizeBytes: sizeBytes };
}

function makeVideo(id: string, durationSec = 30, sizeBytes?: number): MediaItem {
  return { id, url: `https://example.com/${id}.mp4`, mimeType: 'video/mp4', durationSec, fileSizeBytes: sizeBytes };
}

describe('PLATFORM_CAPS — coherence', () => {
  it('toutes les 6 plateformes définies', () => {
    expect(Object.keys(PLATFORM_CAPS)).toEqual([
      'instagram',
      'facebook',
      'tiktok',
      'twitter',
      'linkedin',
      'pinterest',
    ]);
  });

  it('Instagram maxImages=10 (carrousel)', () => {
    expect(PLATFORM_CAPS.instagram.maxImages).toBe(10);
    expect(PLATFORM_CAPS.instagram.acceptsCarousel).toBe(true);
  });

  it('Twitter maxImages=4 (limite officielle)', () => {
    expect(PLATFORM_CAPS.twitter.maxImages).toBe(4);
  });
});

describe('applyPlatformCaps — Instagram carrousel', () => {
  it('5 images → 5 acceptées (≤ 10)', () => {
    const items = Array.from({ length: 5 }, (_, i) => makeImage(`img-${i}`));
    const r = applyPlatformCaps(items, 'instagram');
    expect(r.accepted).toHaveLength(5);
    expect(r.rejected).toHaveLength(0);
  });

  it('12 images → 10 acceptées + 2 rejetées', () => {
    const items = Array.from({ length: 12 }, (_, i) => makeImage(`img-${i}`));
    const r = applyPlatformCaps(items, 'instagram');
    expect(r.accepted).toHaveLength(10);
    expect(r.rejected).toHaveLength(2);
    expect(r.rejected[0]!.reason).toContain('Plus de 10 images');
  });

  it('1 image + 1 video → mix accepté (Insta acceptsMixed=true)', () => {
    const r = applyPlatformCaps(
      [makeImage('img-0'), makeVideo('vid-0', 30)],
      'instagram',
    );
    expect(r.accepted).toHaveLength(2);
  });

  it('mime non supporté → rejeté', () => {
    const r = applyPlatformCaps([makeImage('bad', 'image/gif')], 'instagram');
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0]!.reason).toContain('Mime type non supporté');
  });

  it('vidéo > 90s → rejetée (limite Reels)', () => {
    const r = applyPlatformCaps([makeVideo('long', 120)], 'instagram');
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0]!.reason).toContain('> 90s');
  });

  it('fichier > 100MB → rejeté', () => {
    const big = makeImage('big', 'image/jpeg', 200 * 1024 * 1024);
    const r = applyPlatformCaps([big], 'instagram');
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0]!.reason).toContain('100MB');
  });
});

describe('applyPlatformCaps — TikTok (mode exclusif)', () => {
  it('1 vidéo seule → acceptée', () => {
    const r = applyPlatformCaps([makeVideo('v')], 'tiktok');
    expect(r.accepted).toHaveLength(1);
  });

  it('5 images sans vidéo → toutes acceptées (Photo Mode)', () => {
    const items = Array.from({ length: 5 }, (_, i) => makeImage(`img-${i}`));
    const r = applyPlatformCaps(items, 'tiktok');
    expect(r.accepted).toHaveLength(5);
  });

  it('1 image + 1 vidéo → vidéo prioritaire (acceptsMixed=false)', () => {
    const r = applyPlatformCaps(
      [makeImage('img'), makeVideo('vid')],
      'tiktok',
    );
    expect(r.accepted).toHaveLength(1);
    expect(r.accepted[0]!.id).toBe('vid');
    expect(r.rejected[0]!.reason).toContain('mix images+vidéo');
  });

  it('40 images → 35 acceptées (Photo Mode cap)', () => {
    const items = Array.from({ length: 40 }, (_, i) => makeImage(`img-${i}`));
    const r = applyPlatformCaps(items, 'tiktok');
    expect(r.accepted).toHaveLength(35);
    expect(r.rejected).toHaveLength(5);
  });

  it('vidéo > 600s → rejetée (10min cap)', () => {
    const r = applyPlatformCaps([makeVideo('long', 700)], 'tiktok');
    expect(r.accepted).toHaveLength(0);
  });
});

describe('applyPlatformCaps — Twitter / X', () => {
  it('5 images → 4 acceptées + 1 rejetée', () => {
    const items = Array.from({ length: 5 }, (_, i) => makeImage(`img-${i}`));
    const r = applyPlatformCaps(items, 'twitter');
    expect(r.accepted).toHaveLength(4);
    expect(r.rejected).toHaveLength(1);
  });

  it('vidéo > 140s → rejetée', () => {
    const r = applyPlatformCaps([makeVideo('long', 180)], 'twitter');
    expect(r.accepted).toHaveLength(0);
  });
});

describe('applyPlatformCaps — Pinterest (single pin)', () => {
  it('3 images → 1ère gardée seulement (carrousel non supporté)', () => {
    const items = Array.from({ length: 3 }, (_, i) => makeImage(`img-${i}`));
    const r = applyPlatformCaps(items, 'pinterest');
    expect(r.accepted).toHaveLength(1);
    expect(r.accepted[0]!.id).toBe('img-0');
    expect(r.rejected).toHaveLength(2);
    expect(r.rejected[0]!.reason).toContain('Carrousel non supporté');
  });
});

describe('applyPlatformCaps — Facebook', () => {
  it('exclusif images vs vidéo (acceptsMixed=false)', () => {
    const r = applyPlatformCaps(
      [makeImage('img-1'), makeImage('img-2'), makeVideo('vid-1')],
      'facebook',
    );
    expect(r.accepted).toHaveLength(1);
    expect(r.accepted[0]!.id).toBe('vid-1');
  });

  it('multi-images sans vidéo → carrousel jusqu\'à 10', () => {
    const items = Array.from({ length: 8 }, (_, i) => makeImage(`img-${i}`));
    const r = applyPlatformCaps(items, 'facebook');
    expect(r.accepted).toHaveLength(8);
  });
});

describe('applyPlatformCaps — robustesse', () => {
  it('liste vide → accepted=[], rejected=[]', () => {
    const r = applyPlatformCaps([], 'instagram');
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected).toHaveLength(0);
  });

  it('ne mute pas l\'input', () => {
    const items = [makeImage('a'), makeImage('b')];
    const snapshot = JSON.stringify(items);
    applyPlatformCaps(items, 'instagram');
    expect(JSON.stringify(items)).toBe(snapshot);
  });
});
