import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import {
  failNextSocialPublishingCall,
  getSocialPublishingRecordedCalls,
  resetSocialPublishingMocks,
  setSocialPublishingStatus,
  socialPublishingHandlers,
} from './social-publishing-handlers';

const server = setupServer(...socialPublishingHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
beforeEach(() => resetSocialPublishingMocks());
afterEach(() => server.resetHandlers());

describe('socialPublishingHandlers', () => {
  it('mocke le flow Meta container puis publish', async () => {
    const container = await fetch('https://graph.facebook.com/v21.0/178000/media', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image_url: 'https://cdn.test/image.png', caption: 'test' }),
    });
    const publish = await fetch('https://graph.facebook.com/v21.0/178000/media_publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ creation_id: 'mock_meta_container_id' }),
    });

    await expect(container.json()).resolves.toMatchObject({ id: 'mock_meta_container_id' });
    await expect(publish.json()).resolves.toMatchObject({ id: 'mock_meta_publication_id' });
    expect(getSocialPublishingRecordedCalls('meta_container')).toHaveLength(1);
    expect(getSocialPublishingRecordedCalls('meta_publish')).toHaveLength(1);
  });

  it('simule une erreur Meta 429 sur le prochain appel', async () => {
    setSocialPublishingStatus('meta_container', 429);
    failNextSocialPublishingCall('meta_container');

    const failed = await fetch('https://graph.facebook.com/v21.0/178000/media', { method: 'POST', body: '{}' });
    const ok = await fetch('https://graph.facebook.com/v21.0/178000/media', { method: 'POST', body: '{}' });

    expect(failed.status).toBe(429);
    expect(ok.status).toBe(200);
    expect(getSocialPublishingRecordedCalls('meta_container')).toHaveLength(2);
  });

  it('mocke Postiz upload et création de post', async () => {
    const upload = await fetch('https://postiz.test/api/upload', { method: 'POST', body: '{}' });
    const post = await fetch('https://postiz.test/api/posts', { method: 'POST', body: JSON.stringify({ content: 'test' }) });

    expect(upload.status).toBe(200);
    await expect(post.json()).resolves.toMatchObject({ id: 'mock_postiz_post_id' });
    expect(getSocialPublishingRecordedCalls('postiz_media')).toHaveLength(1);
    expect(getSocialPublishingRecordedCalls('postiz_posts')).toHaveLength(1);
  });

  it('reset nettoie les appels capturés', async () => {
    await fetch('https://postiz.test/api/posts', { method: 'POST', body: '{}' });
    expect(getSocialPublishingRecordedCalls()).toHaveLength(1);
    resetSocialPublishingMocks();
    expect(getSocialPublishingRecordedCalls()).toHaveLength(0);
  });
});
