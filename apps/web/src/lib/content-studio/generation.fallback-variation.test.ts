import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildContentIdea } from '@/test/factories/content-studio';

/**
 * ACT-BE-013 (variation du fallback) — le template déterministe n'est plus figé :
 * hooks variés par format, hashtags par pilier. Deux idées de format/pilier
 * distincts produisent des textes distincts.
 */
const KEYS = [
  'AI_ENGINE_OPENAI_API_KEY',
  'CONTENT_STUDIO_OPENAI_API_KEY',
  'CHAT_OPENAI_API_KEY',
  'OPENAI_API_KEY',
];

describe('fallbackGeneration — varié par format/pilier', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('ADMIN_SESSION_PASSWORD', 'a'.repeat(32));
    vi.stubEnv('WEBHOOK_SECRET_KEY', 'b'.repeat(32));
    vi.stubEnv('CRON_SECRET', 'c'.repeat(32));
    for (const k of KEYS) vi.stubEnv(k, '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('un reel et un post produisent des hooks distincts (fallback non figé)', async () => {
    const { generateForIdea } = await import('./generation');
    const reel = await generateForIdea(buildContentIdea({ format: 'reel' }), { mode: 'mock' });
    const post = await generateForIdea(buildContentIdea({ format: 'post' }), { mode: 'mock' });
    expect(reel.provider).toBe('fallback');
    expect(reel.drafts[0]!.hook).not.toBe(post.drafts[0]!.hook);
  });

  it('les hashtags varient par pilier', async () => {
    const { generateForIdea } = await import('./generation');
    const produit = await generateForIdea(buildContentIdea({ pillar: 'produit' }), { mode: 'mock' });
    const rituel = await generateForIdea(buildContentIdea({ pillar: 'rituel' }), { mode: 'mock' });
    expect(produit.drafts[0]!.hashtags).not.toEqual(rituel.drafts[0]!.hashtags);
  });
});
