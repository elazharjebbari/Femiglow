import { describe, it, expect } from 'vitest';
import { resolveConfig, pickVariants, buildSrcset } from './config';
import { makeImageMedia } from '@/lib/media/components/__fixtures__/media';

describe('resolveConfig', () => {
  it('priority=true → eager + fetchPriority high + decoding sync', () => {
    const m = makeImageMedia();
    const c = resolveConfig({ media: m, context: 'inline', props: { priority: true } });
    expect(c.loadingStrategy).toBe('eager');
    expect(c.fetchPriority).toBe('high');
    expect(c.decoding).toBe('sync');
  });

  it('context=hero force qualityProfile=hero', () => {
    const m = makeImageMedia({ qualityProfile: 'inline' });
    const c = resolveConfig({ media: m, context: 'hero' });
    expect(c.qualityProfile).toBe('hero');
  });

  it('overrides DB > defaults', () => {
    const m = makeImageMedia({
      overrides: { loadingStrategy: 'idle', qualityProfile: 'thumb' },
    });
    const c = resolveConfig({ media: m, context: 'inline' });
    expect(c.loadingStrategy).toBe('idle');
    expect(c.qualityProfile).toBe('thumb');
  });

  it('alt prop > DB.alt', () => {
    const m = makeImageMedia();
    const c = resolveConfig({ media: m, context: 'inline', props: { alt: 'override' } });
    expect(c.alt).toBe('override');
  });
});

describe('pickVariants', () => {
  it('regroupe par format et trie par width', () => {
    const m = makeImageMedia();
    const c = resolveConfig({ media: m, context: 'inline' });
    const picked = pickVariants(m.variants, c);
    const jpeg = picked.byFormat.get('jpeg')!;
    expect(jpeg.map((e) => e.width)).toEqual([480, 1024]);
    expect(picked.bestFormat).toBe('avif');
  });
});

describe('buildSrcset', () => {
  it('format URL widthw, , URL widthw', () => {
    const s = buildSrcset([
      { width: 480, url: '/a.jpg' },
      { width: 1024, url: '/b.jpg' },
    ]);
    expect(s).toBe('/a.jpg 480w, /b.jpg 1024w');
  });
});
