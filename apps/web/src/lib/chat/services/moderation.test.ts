/**
 * Tests `moderateChatText` + `decideOnModeration`.
 *
 * Couvre tous les chemins :
 *  - Flag off → pass-through
 *  - Flag on + content safe → flagged=false
 *  - Flag on + content offensive → flagged=true + categories
 *  - Provider timeout/error → fail-soft + log warn
 *  - Text vide → pass-through
 *  - Decision : inbound vs outbound, hard categories vs soft
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { moderateChatText, decideOnModeration } from './moderation';
import type { ChatProvider } from '@/lib/chat/providers/types';

// Mock the feature flag — default off, on dans certains tests
vi.mock('@/lib/feature-flags/live-systems', () => ({
  get LIVE_CHAT_MODERATION() {
    return (globalThis as { __LIVE_CHAT_MODERATION_MOCK?: string }).__LIVE_CHAT_MODERATION_MOCK ?? 'off';
  },
}));

function setFlag(value: 'on' | 'off'): void {
  (globalThis as { __LIVE_CHAT_MODERATION_MOCK?: string }).__LIVE_CHAT_MODERATION_MOCK = value;
}

function makeProvider(overrides?: Partial<ChatProvider>): ChatProvider {
  return {
    id: 'test',
    chat: vi.fn(),
    embed: vi.fn(),
    moderate: vi.fn().mockResolvedValue({
      flagged: false,
      categories: [],
      scores: {},
    }),
    ping: vi.fn(),
    ...overrides,
  } as unknown as ChatProvider;
}

beforeEach(() => {
  setFlag('off');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('moderateChatText — flag OFF', () => {
  it('default OFF → pass-through (source disabled)', async () => {
    const provider = makeProvider();
    const result = await moderateChatText(provider, 'any text', {
      sessionId: 's1',
      direction: 'inbound',
    });
    expect(result.flagged).toBe(false);
    expect(result.source).toBe('disabled');
    expect(provider.moderate).not.toHaveBeenCalled();
  });
});

describe('moderateChatText — flag ON', () => {
  beforeEach(() => setFlag('on'));

  it('content safe → flagged=false, source=openai', async () => {
    const provider = makeProvider();
    const result = await moderateChatText(provider, 'Bonjour, je veux acheter le pack', {
      sessionId: 's1',
      direction: 'inbound',
    });
    expect(result.flagged).toBe(false);
    expect(result.source).toBe('openai');
    expect(provider.moderate).toHaveBeenCalledOnce();
  });

  it('content offensive → flagged=true + categories', async () => {
    const provider = makeProvider({
      moderate: vi.fn().mockResolvedValue({
        flagged: true,
        categories: ['hate', 'harassment'],
        scores: { hate: 0.95, harassment: 0.87 },
      }),
    });
    const result = await moderateChatText(provider, 'offensive content', {
      sessionId: 's1',
      direction: 'inbound',
    });
    expect(result.flagged).toBe(true);
    expect(result.categories).toEqual(['hate', 'harassment']);
    expect(result.scores.hate).toBe(0.95);
  });

  it('text vide → pass-through (skip API call)', async () => {
    const provider = makeProvider();
    const result = await moderateChatText(provider, '', {
      sessionId: 's1',
      direction: 'inbound',
    });
    expect(result.source).toBe('disabled');
    expect(provider.moderate).not.toHaveBeenCalled();
  });

  it('text whitespace only → pass-through', async () => {
    const provider = makeProvider();
    const result = await moderateChatText(provider, '   \n\t  ', {
      sessionId: 's1',
      direction: 'inbound',
    });
    expect(result.source).toBe('disabled');
    expect(provider.moderate).not.toHaveBeenCalled();
  });
});

describe('moderateChatText — fail-soft', () => {
  beforeEach(() => setFlag('on'));

  it('Provider throws timeout → fail-soft (continue + log warn)', async () => {
    const provider = makeProvider({
      moderate: vi.fn().mockRejectedValue(new Error('Request timeout')),
    });
    const result = await moderateChatText(provider, 'test', {
      sessionId: 's1',
      direction: 'inbound',
    });
    expect(result.flagged).toBe(false); // pass-through
    expect(result.source).toBe('fail_soft');
  });

  it('Provider 500 → fail-soft', async () => {
    const provider = makeProvider({
      moderate: vi.fn().mockRejectedValue(new Error('HTTP 500 Internal Server Error')),
    });
    const result = await moderateChatText(provider, 'test', {
      sessionId: 's1',
      direction: 'outbound',
    });
    expect(result.source).toBe('fail_soft');
  });

  it('Latence trackée même en fail-soft', async () => {
    const provider = makeProvider({
      moderate: vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 50));
        throw new Error('fail');
      }),
    });
    const result = await moderateChatText(provider, 'test', {
      sessionId: 's1',
      direction: 'inbound',
    });
    expect(result.latencyMs).toBeGreaterThanOrEqual(50);
  });
});

describe('decideOnModeration', () => {
  it('not flagged → allow', () => {
    const decision = decideOnModeration(
      { flagged: false, categories: [], scores: {}, source: 'openai', latencyMs: 10 },
      'inbound',
    );
    expect(decision.action).toBe('allow');
  });

  it('flagged inbound → replace_scripted (avec message FR)', () => {
    const decision = decideOnModeration(
      {
        flagged: true,
        categories: ['hate'],
        scores: { hate: 0.9 },
        source: 'openai',
        latencyMs: 10,
      },
      'inbound',
    );
    expect(decision.action).toBe('replace_scripted');
    expect(decision.scriptedMessage).toContain('Je ne suis pas en mesure');
  });

  it('flagged outbound soft → truncate (sans message scripté)', () => {
    const decision = decideOnModeration(
      {
        flagged: true,
        categories: ['harassment'],
        scores: { harassment: 0.7 },
        source: 'openai',
        latencyMs: 10,
      },
      'outbound',
    );
    expect(decision.action).toBe('truncate');
  });

  it('flagged outbound hard (sexual/minors) → reject', () => {
    const decision = decideOnModeration(
      {
        flagged: true,
        categories: ['sexual/minors'],
        scores: { 'sexual/minors': 0.95 },
        source: 'openai',
        latencyMs: 10,
      },
      'outbound',
    );
    expect(decision.action).toBe('reject');
    expect(decision.scriptedMessage).toContain('retirée');
  });

  it('flagged outbound hard (violence/graphic) → reject', () => {
    const decision = decideOnModeration(
      {
        flagged: true,
        categories: ['violence/graphic', 'hate'],
        scores: { 'violence/graphic': 0.9 },
        source: 'openai',
        latencyMs: 10,
      },
      'outbound',
    );
    expect(decision.action).toBe('reject');
  });
});
