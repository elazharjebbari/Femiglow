import { beforeEach, describe, expect, it } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { createContentIdea } from './service';
import { approveDraft, createBrief, createDrafts } from './repository';

beforeEach(() => {
  resetMemoryStore();
});

describe('approveDraft — un draft = un post (P1-4, migration 0066)', () => {
  it('un double approve du même draft renvoie le même post (idempotent, pas de doublon)', async () => {
    const idea = await createContentIdea({
      pillar: 'rituel',
      objective: 'conversion',
      platform: 'instagram',
      format: 'post',
      prompt: 'Post de test approve idempotent.',
      actorId: 'adm_approve_race',
    });
    const brief = await createBrief({
      ideaId: idea.id,
      angle: 'Angle test',
      cta: 'CTA test',
      actorId: 'adm_approve_race',
    });
    const [draft] = await createDrafts([
      {
        briefId: brief.id,
        platform: 'instagram',
        format: 'post',
        variantLabel: 'A',
        caption: 'Caption de test #test',
        altText: 'Alt test',
        hashtags: ['test'],
      },
    ]);
    expect(draft).toBeDefined();

    // Simule le double-clic concurrent : deux approves sur le même draft.
    // En Postgres c'est la contrainte unique content_post_draft_unique qui
    // gagne la course ; le store mémoire simule la même sémantique.
    const first = await approveDraft({ draftId: draft!.id, actorId: 'adm_a' });
    const second = await approveDraft({ draftId: draft!.id, actorId: 'adm_b' });

    expect(second.id).toBe(first.id);
    expect(second.draftId).toBe(draft!.id);
  });
});
