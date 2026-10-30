import { afterEach, describe, expect, it, vi } from 'vitest';

import { isKitRootRewriteEnabled, resolveKitRootRewrite } from './kit-root-rewrite';

describe('resolveKitRootRewrite', () => {
  it('actif par défaut quand la variable est absente', () => {
    expect(resolveKitRootRewrite(undefined)).toBe(true);
  });

  it.each(['off', 'false', '0', 'OFF', ' False ', '0 '])('désactivé pour « %s »', (v) => {
    expect(resolveKitRootRewrite(v)).toBe(false);
  });

  it.each(['on', 'true', '1', '', 'yes'])('actif pour « %s »', (v) => {
    expect(resolveKitRootRewrite(v)).toBe(true);
  });
});

describe('isKitRootRewriteEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lit KIT_ROOT_REWRITE à chaque appel', () => {
    vi.stubEnv('KIT_ROOT_REWRITE', 'off');
    expect(isKitRootRewriteEnabled()).toBe(false);
    vi.stubEnv('KIT_ROOT_REWRITE', 'on');
    expect(isKitRootRewriteEnabled()).toBe(true);
  });
});
