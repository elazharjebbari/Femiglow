import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isHeroMediaVariantsEnabled,
  isHeroMediaVariantsQueryOff,
  resolveHeroMediaVariantsEnv,
} from './hero-media-variants';

describe('resolveHeroMediaVariantsEnv', () => {
  it('désactivé par défaut (variable absente)', () => {
    expect(resolveHeroMediaVariantsEnv(undefined)).toBe(false);
  });

  it.each(['on', 'ON', ' true ', '1'])('activé pour %j', (value) => {
    expect(resolveHeroMediaVariantsEnv(value)).toBe(true);
  });

  it.each(['off', 'false', '0', '', 'yes', 'enabled'])('désactivé pour %j', (value) => {
    expect(resolveHeroMediaVariantsEnv(value)).toBe(false);
  });
});

describe('isHeroMediaVariantsQueryOff', () => {
  it.each([
    ['off', true],
    ['OFF', true],
    [['off', 'on'], true],
    ['on', false],
    [undefined, false],
    [['on', 'off'], false],
  ])('%j → %s', (value, expected) => {
    expect(isHeroMediaVariantsQueryOff(value)).toBe(expected);
  });
});

describe('isHeroMediaVariantsEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('les trois niveaux doivent laisser passer', () => {
    expect(isHeroMediaVariantsEnabled({ cmsEnabled: true, envValue: 'on' })).toBe(true);
    expect(isHeroMediaVariantsEnabled({ cmsEnabled: true, envValue: 'off' })).toBe(false);
    expect(isHeroMediaVariantsEnabled({ cmsEnabled: false, envValue: 'on' })).toBe(false);
    expect(
      isHeroMediaVariantsEnabled({ cmsEnabled: true, envValue: 'on', queryOverride: 'off' }),
    ).toBe(false);
  });

  it('champ CMS : seul le booléen strict true active', () => {
    for (const cmsEnabled of [undefined, null, 'true', 1]) {
      expect(isHeroMediaVariantsEnabled({ cmsEnabled, envValue: 'on' })).toBe(false);
    }
  });

  it('lit process.env.HERO_MEDIA_VARIANTS par défaut (désactivé sans variable)', () => {
    vi.stubEnv('HERO_MEDIA_VARIANTS', '');
    expect(isHeroMediaVariantsEnabled({ cmsEnabled: true })).toBe(false);
    vi.stubEnv('HERO_MEDIA_VARIANTS', 'on');
    expect(isHeroMediaVariantsEnabled({ cmsEnabled: true })).toBe(true);
  });
});
