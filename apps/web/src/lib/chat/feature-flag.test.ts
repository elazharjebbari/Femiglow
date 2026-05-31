import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('feature-flag', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns false when CHAT_ENABLED is not set', async () => {
    vi.doMock('@/lib/env', () => ({ env: { CHAT_ENABLED: 'false' } }));
    const mod = await import('./feature-flag');
    expect(mod.isChatEnabled()).toBe(false);
    expect(() => mod.assertChatEnabled()).toThrow(mod.ChatDisabledError);
  });

  it('returns true when CHAT_ENABLED=true', async () => {
    vi.doMock('@/lib/env', () => ({ env: { CHAT_ENABLED: 'true' } }));
    const mod = await import('./feature-flag');
    expect(mod.isChatEnabled()).toBe(true);
    expect(() => mod.assertChatEnabled()).not.toThrow();
  });
});

describe('feature-flag — CHA-230 Phase 2', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('isLlmIntentEnabled', () => {
    it('returns false by default (flag absent / "false")', async () => {
      vi.doMock('@/lib/env', () => ({
        env: { CHAT_LLM_INTENT_ENABLED: 'false' },
      }));
      const mod = await import('./feature-flag');
      expect(mod.isLlmIntentEnabled()).toBe(false);
    });

    it('returns true when CHAT_LLM_INTENT_ENABLED="true"', async () => {
      vi.doMock('@/lib/env', () => ({
        env: { CHAT_LLM_INTENT_ENABLED: 'true' },
      }));
      const mod = await import('./feature-flag');
      expect(mod.isLlmIntentEnabled()).toBe(true);
    });

    it('returns false for any non-"true" string (truthy values do not count)', async () => {
      // Garde-fou : `'1'`, `'TRUE'`, `'yes'` ne doivent pas activer le flag.
      // C'est le contrat du parsing zod en amont — on le re-vérifie ici parce
      // qu'un dérapage côté env aurait des conséquences en prod (rollout
      // accidentel).
      vi.doMock('@/lib/env', () => ({
        env: { CHAT_LLM_INTENT_ENABLED: '1' },
      }));
      const mod = await import('./feature-flag');
      expect(mod.isLlmIntentEnabled()).toBe(false);
    });
  });

  describe('isProviderFallbackEnabled', () => {
    it('returns false by default', async () => {
      vi.doMock('@/lib/env', () => ({
        env: { CHAT_PROVIDER_FALLBACK_ENABLED: 'false' },
      }));
      const mod = await import('./feature-flag');
      expect(mod.isProviderFallbackEnabled()).toBe(false);
    });

    it('returns true when CHAT_PROVIDER_FALLBACK_ENABLED="true"', async () => {
      vi.doMock('@/lib/env', () => ({
        env: { CHAT_PROVIDER_FALLBACK_ENABLED: 'true' },
      }));
      const mod = await import('./feature-flag');
      expect(mod.isProviderFallbackEnabled()).toBe(true);
    });
  });

  it('flags are independent — toggling one does not affect the other', async () => {
    vi.doMock('@/lib/env', () => ({
      env: {
        CHAT_LLM_INTENT_ENABLED: 'true',
        CHAT_PROVIDER_FALLBACK_ENABLED: 'false',
      },
    }));
    const mod = await import('./feature-flag');
    expect(mod.isLlmIntentEnabled()).toBe(true);
    expect(mod.isProviderFallbackEnabled()).toBe(false);
  });
});
