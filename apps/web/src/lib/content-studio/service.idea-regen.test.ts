import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { createContentIdea, generateIdeaDrafts } from './service';
import { listGenerationRuns } from './repository';

/**
 * ACT-BE-016 (BUG-051) — re-générer une idée déjà « generated » doit échouer
 * proprement (HttpError invalid_state → 409) AVANT toute écriture, et ne pas
 * laisser de brief/draft/generation_run orphelin (la garde était placée APRÈS
 * les écritures).
 */
beforeEach(() => {
  resetMemoryStore();
  vi.stubEnv('CONTENT_STUDIO_IMAGE_PROVIDER', 'mock');
});

describe('generateIdeaDrafts — garde de re-génération', () => {
  it('refuse une idée déjà generated avec 409 et SANS écriture partielle', async () => {
    const idea = await createContentIdea({
      pillar: 'rituel',
      objective: 'conversion',
      platform: 'instagram',
      format: 'post',
      prompt: 'Re-gen guard test.',
      actorId: 'adm_test',
    });

    // 1ʳᵉ génération : succès → statut generated.
    const first = await generateIdeaDrafts({ ideaId: idea.id, actorId: 'adm_test' });
    expect(first.idea.status).toBe('generated');
    const runsAfterFirst = (await listGenerationRuns()).length;
    expect(runsAfterFirst).toBeGreaterThanOrEqual(1);

    // 2ᵉ génération sur la même idée : rejet 409 (transition generated→generated interdite).
    await expect(
      generateIdeaDrafts({ ideaId: idea.id, actorId: 'adm_test' }),
    ).rejects.toMatchObject({ code: 'invalid_state', status: 409 });

    // Aucune écriture partielle : pas de generation_run supplémentaire.
    const runsAfterSecond = (await listGenerationRuns()).length;
    expect(runsAfterSecond).toBe(runsAfterFirst);
  });
});
