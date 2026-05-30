import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveProviderCredentialFromEnv } from './provider-credentials';

/**
 * ACT-ARC-013 / ACT-BE-010 — preuve unitaire que le split d'env de BUG-001 est
 * fermé : une CONTENT_STUDIO_OPENAI_API_KEY vide ne masque plus le fallback
 * OPENAI_API_KEY (le `??` historique laissait passer la chaîne vide).
 */
describe('resolveProviderCredentialFromEnv (BUG-001 split env)', () => {
  const KEYS = [
    'AI_ENGINE_OPENAI_API_KEY',
    'CONTENT_STUDIO_OPENAI_API_KEY',
    'CHAT_OPENAI_API_KEY',
    'OPENAI_API_KEY',
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('chaîne vide CONTENT_STUDIO_OPENAI_API_KEY ne masque PAS OPENAI_API_KEY', () => {
    process.env.CONTENT_STUDIO_OPENAI_API_KEY = '';
    process.env.OPENAI_API_KEY = 'sk-fallback-key';
    expect(resolveProviderCredentialFromEnv('openai')).toBe('sk-fallback-key');
  });

  it('honore la priorité de la chaîne (première variable non vide)', () => {
    process.env.CONTENT_STUDIO_OPENAI_API_KEY = 'sk-content-studio';
    process.env.OPENAI_API_KEY = 'sk-fallback-key';
    expect(resolveProviderCredentialFromEnv('openai')).toBe('sk-content-studio');
  });

  it('retourne undefined quand aucune variable de la chaîne n\'est définie', () => {
    expect(resolveProviderCredentialFromEnv('openai')).toBeUndefined();
  });

  it('neutralise les chaînes blanches et trim', () => {
    process.env.OPENAI_API_KEY = '   ';
    expect(resolveProviderCredentialFromEnv('openai')).toBeUndefined();
    process.env.OPENAI_API_KEY = '  sk-trim  ';
    expect(resolveProviderCredentialFromEnv('openai')).toBe('sk-trim');
  });
});
