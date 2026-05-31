/**
 * CHA-LEAD-V2 — Test du feature flag CHAT_ADMIN_FILTERS_V2.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('isChatAdminFiltersV2Enabled', () => {
  const original = process.env.CHAT_ADMIN_FILTERS_V2;

  beforeEach(() => {
    delete process.env.CHAT_ADMIN_FILTERS_V2;
    vi.resetModules();
  });

  afterEach(() => {
    if (original !== undefined) {
      process.env.CHAT_ADMIN_FILTERS_V2 = original;
    } else {
      delete process.env.CHAT_ADMIN_FILTERS_V2;
    }
    vi.resetModules();
  });

  it('renvoie false par défaut (env var absente)', async () => {
    process.env.CHAT_ADMIN_FILTERS_V2 = 'false';
    const { isChatAdminFiltersV2Enabled } = await import('./feature-flag');
    expect(isChatAdminFiltersV2Enabled()).toBe(false);
  });

  it('renvoie true si CHAT_ADMIN_FILTERS_V2=true', async () => {
    process.env.CHAT_ADMIN_FILTERS_V2 = 'true';
    const { isChatAdminFiltersV2Enabled } = await import('./feature-flag');
    expect(isChatAdminFiltersV2Enabled()).toBe(true);
  });

  it('renvoie false pour CHAT_ADMIN_FILTERS_V2=false', async () => {
    process.env.CHAT_ADMIN_FILTERS_V2 = 'false';
    const { isChatAdminFiltersV2Enabled } = await import('./feature-flag');
    expect(isChatAdminFiltersV2Enabled()).toBe(false);
  });
});
