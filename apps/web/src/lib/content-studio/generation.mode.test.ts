import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildContentIdea } from '@/test/factories/content-studio';

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

describe('generateForIdea — mode mock/live', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('ADMIN_SESSION_PASSWORD', 'a'.repeat(32));
    vi.stubEnv('WEBHOOK_SECRET_KEY', 'b'.repeat(32));
    vi.stubEnv('CRON_SECRET', 'c'.repeat(32));
    for (const k of OPENAI_KEYS) vi.stubEnv(k, '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('mode=mock → fallback déterministe même si une clé est présente (aucun LLM)', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-present-but-must-be-ignored');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { generateForIdea } = await import('./generation');
    const out = await generateForIdea(buildContentIdea(), { mode: 'mock' });
    expect(out.provider).toBe('fallback');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('mode=live sans clé résolue → HttpError invalid_state (pas de fallback silencieux)', async () => {
    const { generateForIdea } = await import('./generation');
    await expect(
      generateForIdea(buildContentIdea(), { mode: 'live' }),
    ).rejects.toMatchObject({ code: 'invalid_state', status: 409 });
  });
});
