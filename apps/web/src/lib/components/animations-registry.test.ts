/**
 * Tests unitaires — registre des profils d'animation.
 */
import { describe, it, expect } from 'vitest';
import {
  ANIMATION_REGISTRY,
  findAnimationProfile,
  listAnimationKeys,
} from './animations-registry';

describe('ANIMATION_REGISTRY', () => {
  it('inclut les 7 profils canoniques V1', () => {
    const keys = ANIMATION_REGISTRY.map((p) => p.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'none',
        'fade-in',
        'reveal-up',
        'scale-hover',
        'parallax-soft',
        'schema-svg',
        'cross-link',
      ]),
    );
  });

  it('toutes les clés sont uniques', () => {
    const keys = ANIMATION_REGISTRY.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('tous les profils respectent prefers-reduced-motion', () => {
    for (const p of ANIMATION_REGISTRY) {
      expect(p.respectsReducedMotion, `${p.key}`).toBe(true);
    }
  });

  it('le profil `none` est de type kind=none avec config vide', () => {
    const none = findAnimationProfile('none');
    expect(none).toBeDefined();
    expect(none?.kind).toBe('none');
    expect(none?.config).toEqual({});
  });

  it('listAnimationKeys est cohérent avec le registre', () => {
    expect(listAnimationKeys().sort()).toEqual(
      ANIMATION_REGISTRY.map((p) => p.key).sort(),
    );
  });
});
