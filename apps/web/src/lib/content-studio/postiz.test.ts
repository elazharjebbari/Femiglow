import { describe, expect, it } from 'vitest';
import { buildPostizDraftPayload, parsePostizUploadedMedia } from './postiz';

describe('content studio postiz payload', () => {
  it('construit un brouillon Instagram', () => {
    const payload = buildPostizDraftPayload({
      integrationId: 'ig_1',
      platform: 'instagram',
      format: 'post',
      content: 'Caption validée',
      image: { id: 'me_1', path: 'https://example.com/image.jpg' },
    });
    expect(payload).toMatchObject({
      type: 'draft',
      posts: [
        {
          integration: { id: 'ig_1' },
          settings: { __type: 'instagram', post_type: 'post' },
        },
      ],
    });
  });

  it('utilise la date planifiée quand elle est fournie', () => {
    const payload = buildPostizDraftPayload({
      integrationId: 'ig_1',
      platform: 'instagram',
      format: 'post',
      content: 'Caption validée',
      scheduledAt: '2026-05-16T10:30:00.000Z',
    });

    expect(payload.date).toBe('2026-05-16T10:30:00.000Z');
  });

  it('construit un brouillon Facebook avec story', () => {
    const payload = buildPostizDraftPayload({
      integrationId: 'fb_1',
      platform: 'facebook',
      format: 'story',
      content: 'Story caption',
      image: { id: 'me_2', path: 'https://example.com/story.jpg' },
    });
    expect(payload).toMatchObject({
      type: 'draft',
      posts: [
        {
          integration: { id: 'fb_1' },
          settings: { __type: 'facebook', post_type: 'story' },
        },
      ],
    });
  });

  it('construit un brouillon sans image', () => {
    const payload = buildPostizDraftPayload({
      integrationId: 'ig_1',
      platform: 'instagram',
      format: 'post',
      content: 'Caption sans image',
    });
    const value = (payload.posts as Array<{ value: unknown[] }>)[0].value[0] as Record<string, unknown>;
    expect(value.image).toBeUndefined();
    expect(value.content).toBe('Caption sans image');
  });

  it('inclut les tags personnalisés', () => {
    const payload = buildPostizDraftPayload({
      integrationId: 'ig_1',
      platform: 'instagram',
      format: 'reel',
      content: 'Reel caption',
      tags: [
        { value: 'femiglow', label: 'FemiGlow' },
        { value: 'soin', label: 'Soin' },
      ],
    });
    expect(payload.tags).toEqual([
      { value: 'femiglow', label: 'FemiGlow' },
      { value: 'soin', label: 'Soin' },
    ]);
    expect((payload.posts as Array<{ settings: Record<string, unknown> }>)[0].settings.post_type).toBe('reel');
  });

  it('utilise la date actuelle + 1h quand aucune date nest fournie', () => {
    const before = Date.now();
    const payload = buildPostizDraftPayload({
      integrationId: 'ig_1',
      platform: 'instagram',
      format: 'post',
      content: 'No date',
    });
    const after = Date.now();
    const date = new Date(payload.date as string);
    expect(date.getTime()).toBeGreaterThanOrEqual(before + 60 * 60 * 1000 - 1000);
    expect(date.getTime()).toBeLessThanOrEqual(after + 60 * 60 * 1000 + 1000);
  });

  it('convertit un carousel en post_type post', () => {
    const payload = buildPostizDraftPayload({
      integrationId: 'ig_1',
      platform: 'instagram',
      format: 'carousel',
      content: 'Carousel caption',
    });
    expect((payload.posts as Array<{ settings: Record<string, unknown> }>)[0].settings.post_type).toBe('post');
  });
});

describe('content studio parsePostizUploadedMedia', () => {
  it('extrait un media uploadé valide', () => {
    const media = parsePostizUploadedMedia({
      id: 'pm_1',
      path: 'https://cdn.example.com/upload.png',
      name: 'upload.png',
      originalName: 'original.png',
      thumbnail: 'https://cdn.example.com/thumb.png',
      alt: 'Alt text',
    });
    expect(media).toEqual({
      id: 'pm_1',
      path: 'https://cdn.example.com/upload.png',
      name: 'upload.png',
      originalName: 'original.png',
      thumbnail: 'https://cdn.example.com/thumb.png',
      alt: 'Alt text',
    });
  });

  it('retourne null si id ou path manquent', () => {
    expect(parsePostizUploadedMedia({ id: 'pm_1' })).toBeNull();
    expect(parsePostizUploadedMedia({ path: 'https://example.com' })).toBeNull();
    expect(parsePostizUploadedMedia({})).toBeNull();
  });

  it('nullifie les champs optionnels non string', () => {
    const media = parsePostizUploadedMedia({ id: 'pm_1', path: 'https://example.com/a.png' });
    expect(media).toEqual({
      id: 'pm_1',
      path: 'https://example.com/a.png',
      name: null,
      originalName: null,
      thumbnail: null,
      alt: null,
    });
  });
});
