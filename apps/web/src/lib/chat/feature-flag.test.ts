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
