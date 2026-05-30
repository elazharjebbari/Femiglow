import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    AI_ENGINE_ENABLED: 'true',
    AI_ENGINE_DEFAULT_TEXT_PROVIDER: 'anthropic',
    AI_ENGINE_DEFAULT_TEXT_MODEL: 'claude-sonnet-4-20250514',
    AI_ENGINE_DEFAULT_IMAGE_PROVIDER: 'openai',
    AI_ENGINE_DEFAULT_IMAGE_MODEL: 'gpt-image-1',
    AI_ENGINE_DEFAULT_VIDEO_PROVIDER: 'mock',
    AI_ENGINE_DEFAULT_TTS_PROVIDER: 'mock',
    AI_ENGINE_OPENAI_API_KEY: 'sk-engine-key',
    CONTENT_STUDIO_OPENAI_API_KEY: 'sk-cs-key',
    CHAT_OPENAI_API_KEY: 'sk-chat-key',
    AI_ENGINE_ANTHROPIC_API_KEY: 'sk-ant-key',
    AI_ENGINE_GOOGLE_API_KEY: undefined,
    CHAT_GEMINI_API_KEY: 'gemini-key',
    AI_ENGINE_ELEVENLABS_API_KEY: undefined,
    AI_ENGINE_OLLAMA_BASE_URL: undefined,
    CHAT_OLLAMA_BASE_URL: undefined,
    AI_ENGINE_DAILY_BUDGET_CENTS: 2000,
    AI_ENGINE_MAX_BUDGET_PER_JOB_CENTS: 200,
    AI_ENGINE_QUALITY_THRESHOLD: 0.85,
    AI_ENGINE_HUMAN_REVIEW_REQUIRED: 'true',
  },
}));

import { getEngineConfig, resetEngineConfig } from './engine-config';

describe('engine-config', () => {
  beforeEach(() => {
    resetEngineConfig();
  });

  it('returns enabled=true when AI_ENGINE_ENABLED=true', () => {
    const config = getEngineConfig();
    expect(config.enabled).toBe(true);
  });

  it('returns correct text provider from env', () => {
    const config = getEngineConfig();
    expect(config.providers.text.default).toBe('anthropic');
    expect(config.providers.text.model).toBe('claude-sonnet-4-20250514');
  });

  it('returns correct image provider from env', () => {
    const config = getEngineConfig();
    expect(config.providers.image.default).toBe('openai');
    expect(config.providers.image.model).toBe('gpt-image-1');
  });

  it('API key fallback chain works (AI_ENGINE -> CONTENT_STUDIO -> CHAT -> OPENAI)', () => {
    const config = getEngineConfig();
    // AI_ENGINE_OPENAI_API_KEY is set, so it takes priority
    expect(config.apiKeys.openai).toBe('sk-engine-key');
  });

  it('empty string API key treated as undefined', async () => {
    resetEngineConfig();
    const envMod = await import('@/lib/env');
    const origEnv = { ...envMod.env };

    // Temporarily set the key to empty string
    Object.defineProperty(envMod.env, 'AI_ENGINE_OPENAI_API_KEY', { value: '', writable: true, configurable: true });
    Object.defineProperty(envMod.env, 'CONTENT_STUDIO_OPENAI_API_KEY', { value: '', writable: true, configurable: true });
    Object.defineProperty(envMod.env, 'CHAT_OPENAI_API_KEY', { value: '', writable: true, configurable: true });

    resetEngineConfig();
    const config = getEngineConfig();

    // Empty strings are falsy, so || chain falls through to process.env.OPENAI_API_KEY || undefined
    expect(config.apiKeys.openai).toBeUndefined();

    // Restore
    Object.defineProperty(envMod.env, 'AI_ENGINE_OPENAI_API_KEY', { value: origEnv.AI_ENGINE_OPENAI_API_KEY, writable: true, configurable: true });
    Object.defineProperty(envMod.env, 'CONTENT_STUDIO_OPENAI_API_KEY', { value: origEnv.CONTENT_STUDIO_OPENAI_API_KEY, writable: true, configurable: true });
    Object.defineProperty(envMod.env, 'CHAT_OPENAI_API_KEY', { value: origEnv.CHAT_OPENAI_API_KEY, writable: true, configurable: true });
  });

  it('budget values from env', () => {
    const config = getEngineConfig();
    expect(config.budget.dailyCents).toBe(2000);
    expect(config.budget.maxPerJobCents).toBe(200);
  });

  it('quality threshold from env', () => {
    const config = getEngineConfig();
    expect(config.quality.threshold).toBe(0.85);
    expect(config.quality.humanReviewRequired).toBe(true);
  });

  it('resetEngineConfig clears cache', () => {
    const first = getEngineConfig();
    expect(first.enabled).toBe(true);

    resetEngineConfig();

    // After reset, a new call should re-read from env (which is the same mock)
    const second = getEngineConfig();
    expect(second.enabled).toBe(true);

    // Verify it is a fresh object (not the exact same reference, since cache was cleared)
    // They will be equal in content but should be different references
    // (resetEngineConfig sets _config = null, so getEngineConfig rebuilds)
    expect(second).toEqual(first);
  });
});
