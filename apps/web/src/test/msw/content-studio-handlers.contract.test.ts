/**
 * Contract tests — verify MSW handlers return shapes compatible with
 * the real route Zod schemas.
 *
 * Detects silent divergence between mock and reality (e.g. a handler
 * returning status: 'brief' while the route returns 'generated').
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { server } from './server';
import {
  contentStudioHandlers,
  createMockState,
  type MockContentStudioState,
} from './content-studio-handlers';
import { contentStudioV2Handlers } from './content-studio-v2-handlers';

let state: MockContentStudioState;

beforeAll(() => {
  state = createMockState();
  const { handlers } = contentStudioV2Handlers();
  server.use(...contentStudioHandlers(state), ...handlers);
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  state = createMockState();
  const { handlers } = contentStudioV2Handlers();
  server.resetHandlers();
  server.use(...contentStudioHandlers(state), ...handlers);
});

afterAll(() => server.close());

const ideaShape = z.object({
  id: z.string(),
  pillar: z.string(),
  objective: z.string(),
  platform: z.string(),
  format: z.string(),
  prompt: z.string(),
  status: z.string(),
});

const draftShape = z.object({
  id: z.string(),
  briefId: z.string(),
  platform: z.string(),
  format: z.string(),
  caption: z.string(),
  status: z.string(),
});

const postShape = z.object({
  id: z.string(),
  draftId: z.string(),
  status: z.string(),
});

const mediaShape = z.object({
  id: z.string(),
  kind: z.string(),
  status: z.string(),
});

describe('MSW ↔ Route contract tests', () => {
  describe('POST /ideas', () => {
    it('returns a valid idea shape', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pillar: 'rituel', objective: 'consideration', platform: 'instagram', format: 'post', prompt: 'Contract test' }),
      });
      const json = await res.json();
      expect(() => z.object({ idea: ideaShape }).parse(json)).not.toThrow();
    });
  });

  describe('POST /ideas/:id/generate', () => {
    it('returns idea with status=generated (not brief)', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/ideas/idea_test1/generate', {
        method: 'POST',
      });
      const json = await res.json();
      expect(json.idea.status).toBe('generated');
      expect(() => z.object({ idea: ideaShape, drafts: z.array(draftShape) }).parse(json)).not.toThrow();
    });
  });

  describe('PATCH /drafts/:id', () => {
    it('returns a valid draft shape', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/drafts/draft_test1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: 'Updated caption' }),
      });
      const json = await res.json();
      expect(() => z.object({ draft: draftShape }).parse(json)).not.toThrow();
    });
  });

  describe('POST /drafts/:id/approve', () => {
    it('returns a valid post shape', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/drafts/draft_test1/approve', {
        method: 'POST',
      });
      const json = await res.json();
      expect(() => z.object({ post: postShape }).parse(json)).not.toThrow();
    });
  });

  describe('POST /drafts/:id/generate-visual', () => {
    it('returns a valid media shape', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/drafts/draft_test1/generate-visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'FemiGlow product on marble' }),
      });
      const json = await res.json();
      expect(() => z.object({ media: mediaShape }).parse(json)).not.toThrow();
    });
  });

  describe('POST /v2/media/upload-and-crop', () => {
    it('returns a valid media shape', async () => {
      const form = new FormData();
      form.append('file', new Blob(['fake-image-data'], { type: 'image/png' }), 'test.png');
      form.append('crop', JSON.stringify({ x: 0, y: 0, width: 100, height: 100 }));
      const res = await fetch('http://localhost/api/admin/content-studio-v2/media/upload-and-crop', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      expect(() => z.object({ media: mediaShape }).parse(json)).not.toThrow();
    });
  });

  describe('POST /v2/media/upload-and-trim', () => {
    it('returns a valid media shape', async () => {
      const form = new FormData();
      form.append('file', new Blob(['fake-video-data'], { type: 'video/mp4' }), 'test.mp4');
      form.append('trim', JSON.stringify({ startSec: 0, endSec: 10 }));
      const res = await fetch('http://localhost/api/admin/content-studio-v2/media/upload-and-trim', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      expect(() => z.object({ media: mediaShape }).parse(json)).not.toThrow();
    });
  });

  describe('GET /ideas (list)', () => {
    it('returns array + pagination', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/ideas?limit=10');
      const json = await res.json();
      const schema = z.object({
        ideas: z.array(ideaShape),
        pagination: z.object({
          limit: z.number(),
          offset: z.number(),
          hasMore: z.boolean(),
        }),
      });
      expect(() => schema.parse(json)).not.toThrow();
    });
  });

  describe('GET /drafts (list)', () => {
    it('returns array', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/drafts?limit=10');
      const json = await res.json();
      expect(() => z.object({ drafts: z.array(draftShape) }).parse(json)).not.toThrow();
    });
  });

  describe('GET /posts (list)', () => {
    it('returns array', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/posts?limit=10');
      const json = await res.json();
      expect(() => z.object({ posts: z.array(postShape) }).parse(json)).not.toThrow();
    });
  });

  describe('POST /drafts/:id/reject', () => {
    it('returns updated draft with rejected status', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/drafts/draft_test1/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Not aligned with brand' }),
      });
      const json = await res.json();
      expect(json.draft.status).toBe('rejected');
    });
  });

  describe('POST /ideas/:id/archive', () => {
    it('returns idea with archived status', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/ideas/idea_test1/archive', {
        method: 'POST',
      });
      const json = await res.json();
      expect(json.idea.status).toBe('archived');
    });
  });
});
