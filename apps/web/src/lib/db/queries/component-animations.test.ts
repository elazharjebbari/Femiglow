/**
 * Tests unitaires — queries `component_animations` + bindings (memoryStore).
 *
 * Couvre :
 *  - upsertAnimationFromSeed (insert + update).
 *  - upsertAnimationBinding : exclusivité du flag isDefault.
 *  - getDefaultAnimationForComponent.
 *  - listAnimationBindings / listAnimationBindingsWithAnimation.
 */
import { beforeEach, describe, it, expect } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { upsertSiteComponentFromSeed } from './site-components';
import {
  upsertAnimationFromSeed,
  upsertAnimationBinding,
  listAnimations,
  listAnimationBindings,
  listAnimationBindingsWithAnimation,
  getAnimationByKey,
  getDefaultAnimationForComponent,
  deleteAnimationBinding,
} from './component-animations';
import type { SiteComponentSeed } from '@/lib/components/registry';
import type { AnimationProfileSeed } from '@/lib/components/animations-registry';

const COMPONENT_SEED: SiteComponentSeed = {
  key: 'home-hero',
  name: 'Hero Accueil',
  description: '',
  category: 'hero',
  pageGroup: 'home',
  filePath: 'src/components/sections/Hero.tsx',
  slots: [
    { key: 'primary', label: 'Principal', required: true, acceptKinds: ['image'] },
  ],
  defaultSvgFallback: null,
  defaultLoadingStrategy: 'eager',
  defaultFetchPriority: 'high',
  supportsAnimation: true,
};

const FADE_SEED: AnimationProfileSeed = {
  key: 'fade-in',
  name: 'Fade-in',
  kind: 'framer-motion',
  description: 'Opacity 0→1',
  config: { duration: 0.6 },
  respectsReducedMotion: true,
  previewSnippet: null,
};

const REVEAL_SEED: AnimationProfileSeed = {
  key: 'reveal-up',
  name: 'Reveal-up',
  kind: 'framer-motion',
  description: 'translateY+opacity au scroll',
  config: { duration: 0.7, distance: 24 },
  respectsReducedMotion: true,
  previewSnippet: null,
};

beforeEach(() => {
  resetMemoryStore();
});

describe('upsertAnimationFromSeed', () => {
  it('insère un nouveau profil', async () => {
    const a = await upsertAnimationFromSeed(FADE_SEED);
    expect(a.id).toMatch(/^anm_/);
    expect(a.key).toBe('fade-in');
    expect(a.config).toEqual({ duration: 0.6 });
  });

  it('met à jour la même clé sans créer de doublon', async () => {
    const first = await upsertAnimationFromSeed(FADE_SEED);
    const updated = await upsertAnimationFromSeed({
      ...FADE_SEED,
      description: 'patched',
      config: { duration: 1.2 },
    });
    expect(updated.id).toBe(first.id);
    expect(updated.description).toBe('patched');
    expect(updated.config).toEqual({ duration: 1.2 });
    expect(await listAnimations()).toHaveLength(1);
  });

  it('getAnimationByKey retrouve le profil', async () => {
    await upsertAnimationFromSeed(FADE_SEED);
    expect((await getAnimationByKey('fade-in'))?.key).toBe('fade-in');
    expect(await getAnimationByKey('inconnu')).toBeNull();
  });
});

describe('upsertAnimationBinding — exclusivité isDefault', () => {
  it('crée un binding non-default par défaut', async () => {
    const c = await upsertSiteComponentFromSeed(COMPONENT_SEED);
    const a = await upsertAnimationFromSeed(FADE_SEED);
    const bnd = await upsertAnimationBinding({
      componentId: c.id,
      animationId: a.id,
    });
    expect(bnd.isDefault).toBe(false);
  });

  it('quand un nouveau binding est marqué default, les autres defaults perdent le flag', async () => {
    const c = await upsertSiteComponentFromSeed(COMPONENT_SEED);
    const fade = await upsertAnimationFromSeed(FADE_SEED);
    const reveal = await upsertAnimationFromSeed(REVEAL_SEED);

    await upsertAnimationBinding({
      componentId: c.id,
      animationId: fade.id,
      isDefault: true,
    });
    await upsertAnimationBinding({
      componentId: c.id,
      animationId: reveal.id,
      isDefault: true,
    });

    const bindings = await listAnimationBindings(c.id);
    const defaults = bindings.filter((b) => b.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.animationId).toBe(reveal.id);
  });

  it('upsert sur (componentId, animationId) → update au lieu d’un doublon', async () => {
    const c = await upsertSiteComponentFromSeed(COMPONENT_SEED);
    const fade = await upsertAnimationFromSeed(FADE_SEED);
    const first = await upsertAnimationBinding({
      componentId: c.id,
      animationId: fade.id,
      params: { delay: 0 },
    });
    const second = await upsertAnimationBinding({
      componentId: c.id,
      animationId: fade.id,
      isDefault: true,
      params: { delay: 0.2 },
    });
    expect(second.id).toBe(first.id);
    expect(second.isDefault).toBe(true);
    expect(second.params).toEqual({ delay: 0.2 });
  });
});

describe('getDefaultAnimationForComponent', () => {
  it('retourne null sans default', async () => {
    const c = await upsertSiteComponentFromSeed(COMPONENT_SEED);
    expect(await getDefaultAnimationForComponent(c.id)).toBeNull();
  });

  it('retourne le profil default actif', async () => {
    const c = await upsertSiteComponentFromSeed(COMPONENT_SEED);
    const fade = await upsertAnimationFromSeed(FADE_SEED);
    await upsertAnimationBinding({
      componentId: c.id,
      animationId: fade.id,
      isDefault: true,
    });
    const def = await getDefaultAnimationForComponent(c.id);
    expect(def?.key).toBe('fade-in');
  });
});

describe('listAnimationBindingsWithAnimation', () => {
  it('joint les bindings avec leur profil', async () => {
    const c = await upsertSiteComponentFromSeed(COMPONENT_SEED);
    const fade = await upsertAnimationFromSeed(FADE_SEED);
    await upsertAnimationBinding({ componentId: c.id, animationId: fade.id });
    const list = await listAnimationBindingsWithAnimation(c.id);
    expect(list).toHaveLength(1);
    expect(list[0]?.animation.key).toBe('fade-in');
  });
});

describe('deleteAnimationBinding', () => {
  it('supprime un binding', async () => {
    const c = await upsertSiteComponentFromSeed(COMPONENT_SEED);
    const fade = await upsertAnimationFromSeed(FADE_SEED);
    const bnd = await upsertAnimationBinding({
      componentId: c.id,
      animationId: fade.id,
    });
    await deleteAnimationBinding(bnd.id);
    expect(await listAnimationBindings(c.id)).toHaveLength(0);
  });
});
