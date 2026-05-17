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
      const draftId = state.drafts[0]!.id;
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
      const draftId = state.drafts[0]!.id;
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

  describe('POST /api/admin/content-studio/drafts/:id/reject', () => {
    it('rejette un draft et retourne le draft mis à jour', async () => {
      const draftId = state.drafts[0]!.id;
      const res = await fetch(`http://localhost/api/admin/content-studio/drafts/${draftId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Pas assez de preuve sociale' }),
      });
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.draft.status).toBe('rejected');
      expect(json.draft.rejectionReason).toBe('Pas assez de preuve sociale');
    });

    it('retourne 404 pour un draft inexistant', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/drafts/nonexistent/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/admin/content-studio/posts/:id/cancel', () => {
    it('annule un post planifié et retourne le post mis à jour', async () => {
      const postId = state.posts[0]!.id;
      const res = await fetch(`http://localhost/api/admin/content-studio/posts/${postId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Changement de planning' }),
      });
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.post.status).toBe('cancelled');
      expect(json.post.cancelReason).toBe('Changement de planning');
    });

    it('retourne 404 pour un post inexistant', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/posts/nonexistent/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/admin/content-studio/ideas/:id/archive', () => {
    it('archive une idée et retourne l\'idée mise à jour', async () => {
      const ideaId = state.ideas[0]!.id;
      const res = await fetch(`http://localhost/api/admin/content-studio/ideas/${ideaId}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.idea.status).toBe('archived');
    });

    it('retourne 404 pour une idée inexistante', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/ideas/nonexistent/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/admin/content-studio/drafts/:id/archive', () => {
    it('archive un draft et retourne le draft mis à jour', async () => {
      const draftId = state.drafts[0]!.id;
      const res = await fetch(`http://localhost/api/admin/content-studio/drafts/${draftId}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.draft.status).toBe('archived');
    });
  });

  describe('POST /api/admin/content-studio/posts/:id/archive', () => {
    it('archive un post et retourne le post mis à jour', async () => {
      const postId = state.posts[0]!.id;
      const res = await fetch(`http://localhost/api/admin/content-studio/posts/${postId}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.post.status).toBe('archived');
    });
  });

  describe('POST /api/admin/content-studio/drafts/:id/variation', () => {
    it('crée une variation d\'un draft existant', async () => {
      const draftId = state.drafts[0]!.id;
      const res = await fetch(`http://localhost/api/admin/content-studio/drafts/${draftId}/variation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.draft).toBeDefined();
      expect(json.draft.parentDraftId).toBe(draftId);
    });

    it('retourne 404 pour un draft inexistant', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/drafts/nonexistent/variation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/admin/content-studio/ideas/:id', () => {
    it('retourne une idée par ID', async () => {
      const ideaId = state.ideas[0]!.id;
      const res = await fetch(`http://localhost/api/admin/content-studio/ideas/${ideaId}`);
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.idea.id).toBe(ideaId);
    });

    it('retourne 404 pour une idée inexistante', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/ideas/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/admin/content-studio/drafts/:id/reviews', () => {
    it('retourne les reviews d\'un draft', async () => {
      const draftId = state.drafts[0]!.id;
      const res = await fetch(`http://localhost/api/admin/content-studio/drafts/${draftId}/reviews`);
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.reviews).toEqual([]);
    });

    it('retourne 404 pour un draft inexistant', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/drafts/nonexistent/reviews');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/admin/content-studio/briefs/:id', () => {
    it('met à jour un brief existant', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/briefs/brief_test1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ angle: 'Nouvel angle éditorial', cta: 'Achetez maintenant' }),
      });
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.brief.angle).toBe('Nouvel angle éditorial');
      expect(json.brief.cta).toBe('Achetez maintenant');
    });
  });

  describe('GET /api/admin/content-studio/briefs/:id', () => {
    it('retourne un brief par ID', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/briefs/brief_test1');
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.brief).toBeDefined();
      expect(json.brief.id).toBe('brief_test1');
      expect(json.brief.angle).toBeDefined();
    });
  });

  describe('POST /api/admin/content-studio/learning-notes', () => {
    it('crée une note d\'apprentissage', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/learning-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: state.posts[0]!.id, note: 'Le hook question génère plus d\'engagement', tags: ['hook', 'engagement'] }),
      });
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.note).toBeDefined();
      expect(json.note.note).toBe('Le hook question génère plus d\'engagement');
      expect(json.note.tags).toEqual(['hook', 'engagement']);
    });
  });

  describe('GET /api/admin/content-studio/learning-notes', () => {
    it('retourne les notes pour un post donné', async () => {
      const postId = state.posts[0]!.id;
      await fetch('http://localhost/api/admin/content-studio/learning-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, note: 'Test note' }),
      });
      const res = await fetch(`http://localhost/api/admin/content-studio/learning-notes?postId=${postId}`);
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.notes.length).toBeGreaterThanOrEqual(1);
      expect(json.notes[0].note).toBe('Test note');
    });
  });

  describe('GET /api/admin/content-studio/utm', () => {
    it('génère les paramètres UTM pour un post', async () => {
      const postId = state.posts[0]!.id;
      const res = await fetch(`http://localhost/api/admin/content-studio/utm?postId=${postId}`);
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.utm).toBeDefined();
      expect(json.utm.utm_source).toBeDefined();
      expect(json.utm.utm_medium).toBeDefined();
      expect(json.utm.utm_campaign).toBeDefined();
    });

    it('retourne 404 pour un post inexistant', async () => {
      const res = await fetch('http://localhost/api/admin/content-studio/utm?postId=nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
