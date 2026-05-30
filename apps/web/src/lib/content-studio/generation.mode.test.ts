import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildContentIdea } from '@/test/factories/content-studio';
import { server } from '@/test/msw/server';

/**
 * ACT-BE-013 (BUG-005) — le mode mock/live pilote RÉELLEMENT la génération de
 * texte : `mock` ne touche jamais le LLM (même clé présente), `live` sans clé
 * résolue échoue clairement au lieu de dégrader silencieusement en template.
 */
const OPENAI_KEYS = [
  'AI_ENGINE_OPENAI_API_KEY',
  'CONTENT_STUDIO_OPENAI_API_KEY',
  'CHAT_OPENAI_API_KEY',
  'OPENAI_API_KEY',
];

// ARC-004 — onUnhandledRequest:'error' : tout fetch émis ferait échouer le test.
// Le mode mock NE doit faire AUCun appel réseau ; l'absence d'erreur le prouve
// (plus fort qu'un spy `not.toHaveBeenCalled`).
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

describe('generateForIdea — mode mock/live', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('ADMIN_SESSION_PASSWORD', 'a'.repeat(32));
    vi.stubEnv('WEBHOOK_SECRET_KEY', 'b'.repeat(32));
    vi.stubEnv('CRON_SECRET', 'c'.repeat(32));
    for (const k of OPENAI_KEYS) vi.stubEnv(k, '');
  });
  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('mode=mock → fallback déterministe même si une clé est présente (aucun LLM)', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-present-but-must-be-ignored');
    const { generateForIdea } = await import('./generation');
    // Aucun handler enregistré : si generateForIdea émettait un fetch, MSW
    // lèverait (onUnhandledRequest:'error') et ferait échouer le test.
    const out = await generateForIdea(buildContentIdea(), { mode: 'mock' });
    expect(out.provider).toBe('fallback');
  });

  it('mode=live sans clé résolue → HttpError invalid_state (pas de fallback silencieux)', async () => {
    const { generateForIdea } = await import('./generation');
    await expect(
      generateForIdea(buildContentIdea(), { mode: 'live' }),
    ).rejects.toMatchObject({ code: 'invalid_state', status: 409 });
  });
});
