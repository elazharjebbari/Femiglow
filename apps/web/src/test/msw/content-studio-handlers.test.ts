import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { server } from './server';
import {
  contentStudioHandlers,
  createMockState,
  type MockContentStudioState,
} from './content-studio-handlers';

let state: MockContentStudioState;

beforeAll(() => {
  state = createMockState();
  server.use(...contentStudioHandlers(state));
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  state = createMockState();
  server.resetHandlers();
  server.use(...contentStudioHandlers(state));
});

afterAll(() => server.close());

describe('MSW — Content Studio API handlers', () => {
  describe('POST /api/admin/content-studio/ideas', () => {
    it('crée une idée et retourne l\'objet idea', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pillar: 'rituel', objective: 'consideration', platform: 'instagram', format: 'post', prompt: 'Test prompt' }),
      });
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.idea).toBeDefined();
      expect(json.idea.pillar).toBe('rituel');
      expect(json.idea.prompt).toBe('Test prompt');
      expect(json.idea.status).toBe('idea');
    });

    it('incrémente le compteur d\'appels', async () => {
      await fetch('http://localhost/api/admin/content-studio/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pillar: 'rituel' }),
      });
      expect(state.callCount['POST /ideas']).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PATCH /api/admin/content-studio/drafts/:id', () => {
    it('met à jour un draft existant', async () => {
      const draftId = state.drafts[0].id;
      const res = await fetch(`http://localhost/api/admin/content-studio/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: 'Updated caption' }),
      });
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.draft.caption).toBe('Updated caption');
    });

    it('retourne 404 pour un draft inexistant', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/drafts/nonexistent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: 'Test' }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/admin/content-studio/drafts/:id/approve', () => {
    it('approuve un draft et crée un post', async () => {
      const draftId = state.drafts[0].id;
      const res = await fetch(`http://localhost/api/admin/content-studio/drafts/${draftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.post).toBeDefined();
      expect(json.post.draftId).toBe(draftId);
    });
  });

  describe('GET /api/admin/content-studio/media', () => {
    it('retourne une liste vide de médias', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/media?compartment=imported');
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.media).toEqual([]);
    });
  });

  describe('POST /api/admin/content-studio/automation', () => {
    it('exécute un job automation', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: 'retry-deliveries', dryRun: true }),
      });
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.job).toBe('retry-deliveries');
      expect(json.result.dryRun).toBe(true);
    });
  });

  describe('POST /api/admin/content-studio/postiz/integrations/sync', () => {
    it('sync les intégrations et retourne une liste vide', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/postiz/integrations/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.integrations).toEqual([]);
    });
  });
});