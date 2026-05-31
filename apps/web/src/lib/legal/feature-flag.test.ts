/**
 * LEGAL-V2 — Test du feature flag LEGAL_VARS_V2.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('isLegalVarsV2Enabled', () => {
  const original = process.env.LEGAL_VARS_V2;

  beforeEach(() => {
    delete process.env.LEGAL_VARS_V2;
    vi.resetModules();
  });

  afterEach(() => {
    if (original !== undefined) process.env.LEGAL_VARS_V2 = original;
    else delete process.env.LEGAL_VARS_V2;
    vi.resetModules();
  });

  it('renvoie false par défaut (env=false)', async () => {
    process.env.LEGAL_VARS_V2 = 'false';
    const { isLegalVarsV2Enabled } = await import('./feature-flag');
    expect(isLegalVarsV2Enabled()).toBe(false);
  });

  it('renvoie true si LEGAL_VARS_V2=true', async () => {
    process.env.LEGAL_VARS_V2 = 'true';
    const { isLegalVarsV2Enabled } = await import('./feature-flag');
    expect(isLegalVarsV2Enabled()).toBe(true);
  });
});
