import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock config
// ---------------------------------------------------------------------------

const mockConfig = {
  enabled: true,
  providers: {
    text: { default: 'openai', model: 'gpt-4' },
    image: { default: 'mock', model: 'mock' },
    video: { default: 'mock' },
    tts: { default: 'mock' },
  },
  apiKeys: {
    openai: 'sk-test',
    anthropic: undefined,
    google: undefined,
    elevenlabs: undefined,
    ollamaBaseUrl: undefined,
  },
  budget: { dailyCents: 1000, maxPerJobCents: 200 },
  quality: { threshold: 0.7, humanReviewRequired: false },
  defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/ai-engine/config', () => ({
  getEngineConfig: vi.fn(() => mockConfig),
}));

// ---------------------------------------------------------------------------
// Import (after mocks)
// ---------------------------------------------------------------------------

import { GET } from '@/app/api/admin/ai-engine/health/route';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/ai-engine/health — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with enabled, providers, budget, quality, and version', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('enabled', true);
    expect(json).toHaveProperty('providers');
    expect(json).toHaveProperty('budget');
    expect(json).toHaveProperty('quality');
    expect(json).toHaveProperty('version');
  });

  it('providers object has text, image, video, and tts keys', async () => {
    const res = await GET();
    const json = await res.json();

    expect(json.providers).toHaveProperty('text');
    expect(json.providers).toHaveProperty('image');
    expect(json.providers).toHaveProperty('video');
    expect(json.providers).toHaveProperty('tts');
  });

  it('each provider has configured boolean and provider string', async () => {
    const res = await GET();
    const json = await res.json();

    for (const key of ['text', 'image', 'video', 'tts']) {
      const provider = json.providers[key];
      expect(typeof provider.configured).toBe('boolean');
      expect(typeof provider.provider).toBe('string');
    }
  });

  it('budget has dailyCents and maxPerJobCents', async () => {
    const res = await GET();
    const json = await res.json();

    expect(json.budget).toHaveProperty('dailyCents');
    expect(json.budget).toHaveProperty('maxPerJobCents');
    expect(typeof json.budget.dailyCents).toBe('number');
    expect(typeof json.budget.maxPerJobCents).toBe('number');
  });

  it('version is a string', async () => {
    const res = await GET();
    const json = await res.json();

    expect(typeof json.version).toBe('string');
    expect(json.version.length).toBeGreaterThan(0);
  });

  it('timestamp is in ISO 8601 format', async () => {
    const res = await GET();
    const json = await res.json();

    expect(json).toHaveProperty('timestamp');
    // Validate ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
    const parsed = Date.parse(json.timestamp);
    expect(Number.isNaN(parsed)).toBe(false);
    expect(json.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
