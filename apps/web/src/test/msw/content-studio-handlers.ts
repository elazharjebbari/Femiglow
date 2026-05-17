/**
 * Handlers MSW pour les routes admin Content Studio.
 * Utilisés par les tests d'intégration qui mockent la couche API.
 */
import { http, HttpResponse } from 'msw';
import {
  buildContentIdea,
  buildContentDraft,
  buildContentPost,
  buildContentPostizDelivery,
} from '../factories/content-studio';

export interface MockContentStudioState {
  ideas: ReturnType<typeof buildContentIdea>[];
  drafts: ReturnType<typeof buildContentDraft>[];
  posts: ReturnType<typeof buildContentPost>[];
  deliveries: ReturnType<typeof buildContentPostizDelivery>[];
  callCount: Record<string, number>;
}

export function createMockState(): MockContentStudioState {
  return {
    ideas: [buildContentIdea()],
    drafts: [buildContentDraft()],
    posts: [buildContentPost()],
    deliveries: [buildContentPostizDelivery()],
    callCount: {},
  };
}

function inc(state: MockContentStudioState, key: string) {
  state.callCount[key] = (state.callCount[key] ?? 0) + 1;
}

export function contentStudioHandlers(state: MockContentStudioState) {
  return [
    // POST /api/admin/content-studio/ideas — create idea
    http.post('http://localhost/api/admin/content-studio/ideas', async ({ request }) => {
      inc(state, 'POST /ideas');
      const body = (await request.json()) as Record<string, unknown>;
      const idea = buildContentIdea({
        pillar: (body.pillar as string) ?? 'rituel',
        objective: (body.objective as string) ?? 'consideration',
        platform: (body.platform as string) ?? 'instagram',
        format: (body.format as string) ?? 'post',
        prompt: (body.prompt as string) ?? '',
        status: 'idea',
      });
      state.ideas.unshift(idea);
      return HttpResponse.json({ idea });
    }),

    // POST /api/admin/content-studio/ideas/:id/generate — generate drafts from idea
    http.post('http://localhost/api/admin/content-studio/ideas/:id/generate', async ({ params }) => {
      inc(state, 'POST /ideas/:id/generate');
      const idea = state.ideas.find((i) => i.id === params.id);
      if (!idea) {
        return HttpResponse.json({ error: 'Idea not found' }, { status: 404 });
      }
      const updatedIdea = { ...idea, status: 'brief' as const };
      const draft = buildContentDraft({ briefId: idea.id });
      state.drafts.unshift(draft);
      const ideaIdx = state.ideas.findIndex((i) => i.id === params.id);
      if (ideaIdx !== -1) state.ideas[ideaIdx] = updatedIdea;
      return HttpResponse.json({ idea: updatedIdea, drafts: [draft] });
    }),

    // PATCH /api/admin/content-studio/drafts/:id — update draft
    http.patch('http://localhost/api/admin/content-studio/drafts/:id', async ({ params, request }) => {
      inc(state, 'PATCH /drafts/:id');
      const body = (await request.json()) as Record<string, unknown>;
      const idx = state.drafts.findIndex((d) => d.id === params.id);
      if (idx === -1) {
        return HttpResponse.json({ error: 'Draft not found' }, { status: 404 });
      }
      state.drafts[idx] = { ...state.drafts[idx], ...body };
      return HttpResponse.json({ draft: state.drafts[idx] });
    }),

    // POST /api/admin/content-studio/drafts/:id/approve — approve draft
    http.post('http://localhost/api/admin/content-studio/drafts/:id/approve', async ({ params }) => {
      inc(state, 'POST /drafts/:id/approve');
      const idx = state.drafts.findIndex((d) => d.id === params.id);
      if (idx === -1) {
        return HttpResponse.json({ error: 'Draft not found' }, { status: 404 });
      }
      state.drafts[idx] = { ...state.drafts[idx], status: 'approved' };
      const post = buildContentPost({ draftId: params.id as string });
      state.posts.unshift(post);
      return HttpResponse.json({ post });
    }),

    // GET /api/admin/content-studio/media — list media
    http.get('http://localhost/api/admin/content-studio/media', () => {
      inc(state, 'GET /media');
      return HttpResponse.json({ media: [] });
    }),

    // POST /api/admin/content-studio/automation — run automation job
    http.post('http://localhost/api/admin/content-studio/automation', async ({ request }) => {
      inc(state, 'POST /automation');
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        job: body.job,
        result: { dryRun: body.dryRun ?? false },
        deliveries: [],
        snapshots: [],
      });
    }),

    // POST /api/admin/content-studio/postiz/integrations/sync — sync integrations
    http.post('http://localhost/api/admin/content-studio/postiz/integrations/sync', () => {
      inc(state, 'POST /postiz/integrations/sync');
      return HttpResponse.json({ integrations: [] });
    }),

    // POST /api/admin/content-studio/posts/:id/postiz-draft — create Postiz draft
    http.post('http://localhost/api/admin/content-studio/posts/:id/postiz-draft', async ({ params }) => {
      inc(state, 'POST /posts/:id/postiz-draft');
      const post = state.posts.find((p) => p.id === params.id);
      if (!post) {
        return HttpResponse.json({ error: 'Post not found' }, { status: 404 });
      }
      const delivery = buildContentPostizDelivery({ postId: params.id as string });
      state.deliveries.unshift(delivery);
      return HttpResponse.json({ delivery, post });
    }),
  ];
}