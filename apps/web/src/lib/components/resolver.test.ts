/**
 * Tests unitaires — resolver Component-Media.
 *
 * NOTE : `unstable_cache` de Next.js est mocké pour rester déterministe
 * (sinon le tag `components` reste invalidé d'un test à l'autre).
 *
 * Couvre la cascade de fallback :
 *  1. Pas de composant         → null
 *  2. Composant sans binding   → fallbackSvg + defaults composant
 *  3. Binding inactif          → fallbackSvg (binding ignoré)
 *  4. Binding actif sans media → fallbackSvg, mais binding non null
 *  5. Binding actif + media    → media + customAlt | media.alt | slot.label
 */
import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
  revalidateTag: vi.fn(),
}));

import { resetMemoryStore } from '@/lib/db/client';
import { upsertSiteComponentFromSeed } from '@/lib/db/queries/site-components';
import { upsertBinding } from '@/lib/db/queries/component-bindings';
import { upsertAnimationFromSeed, upsertAnimationBinding } from '@/lib/db/queries/component-animations';
import { createMedia } from '@/lib/db/queries/media';
import { resolveComponentSlot, resolveComponentSlots } from './resolver';
import type { SiteComponentSeed } from './registry';
import type { AnimationProfileSeed } from './animations-registry';

const COMPONENT_SEED: SiteComponentSeed = {
  key: 'home-hero',
  name: 'Hero Accueil',
  description: 'desc',
  category: 'hero',
  pageGroup: 'home',
  filePath: 'src/components/sections/Hero.tsx',
  slots: [
    {
      key: 'primary',
      label: 'Visuel principal',
      required: true,
      acceptKinds: ['image'],
    },
    {
      key: 'badge',
      label: 'Badge',
      required: false,
      acceptKinds: ['image'],
    },
  ],
  defaultSvgFallback: '/svg/hero.svg',
  defaultLoadingStrategy: 'eager',
  defaultFetchPriority: 'high',
  supportsAnimation: true,
};

const ANIM_SEED: AnimationProfileSeed = {
  key: 'fade-in',
  name: 'Fade-in',
  kind: 'framer-motion',
  description: 'opacity',
  config: {},
  respectsReducedMotion: true,
  previewSnippet: null,
};

beforeEach(() => {
  resetMemoryStore();
});

async function setupComponent() {
  return upsertSiteComponentFromSeed(COMPONENT_SEED);
}

async function setupMedia(slug = 'media-hero', alt = 'Photo hero') {
  return createMedia({
    kind: 'image',
    source: 'upload',
    slug,
    alt,
    caption: null,
    credit: null,
    originalFilename: 'p.png',
    originalMime: 'image/png',
    originalSizeBytes: 1024,
    originalUrl: null,
    qualityProfile: 'hero',
    loadingStrategy: 'eager',
    isHero: true,
    createdBy: null,
  });
}

describe('resolveComponentSlot', () => {
  it('retourne null pour une clé de composant inconnue', async () => {
    expect(await resolveComponentSlot('inexistant', 'primary')).toBeNull();
  });

  it('sans binding : renvoie le fallbackSvg et les defaults du composant', async () => {
    await setupComponent();
    const r = await resolveComponentSlot('home-hero', 'primary');
    expect(r).not.toBeNull();
    expect(r?.binding).toBeNull();
    expect(r?.media).toBeNull();
    expect(r?.fallbackSvg).toBe('/svg/hero.svg');
    expect(r?.loadingStrategy).toBe('eager');
    expect(r?.fetchPriority).toBe('high');
    expect(r?.alt).toBe('Visuel principal');
  });

  it('binding inactif : ignoré, fallbackSvg renvoyé', async () => {
    const c = await setupComponent();
    const m = await setupMedia();
    await upsertBinding({
      componentId: c.id,
      slot: 'primary',
      mediaId: m.id,
      isActive: false,
      customAlt: 'Alt admin',
    });
    const r = await resolveComponentSlot('home-hero', 'primary');
    expect(r?.binding).toBeNull();
    expect(r?.media).toBeNull();
    expect(r?.alt).toBe('Visuel principal');
  });

  it('binding actif sans media : binding renvoyé, fallbackSvg toujours visible', async () => {
    const c = await setupComponent();
    await upsertBinding({
      componentId: c.id,
      slot: 'primary',
      mediaId: null,
      isActive: true,
    });
    const r = await resolveComponentSlot('home-hero', 'primary');
    expect(r?.binding).not.toBeNull();
    expect(r?.media).toBeNull();
    expect(r?.fallbackSvg).toBe('/svg/hero.svg');
  });

  it('binding actif + media : media renvoyé, alt = customAlt > media.alt', async () => {
    const c = await setupComponent();
    const m = await setupMedia('m1', 'Alt média');
    await upsertBinding({
      componentId: c.id,
      slot: 'primary',
      mediaId: m.id,
      isActive: true,
      customAlt: 'Alt admin perso',
      loadingStrategy: 'idle',
      fetchPriority: 'low',
    });
    const r = await resolveComponentSlot('home-hero', 'primary');
    expect(r?.media?.id).toBe(m.id);
    expect(r?.alt).toBe('Alt admin perso');
    expect(r?.loadingStrategy).toBe('idle');
    expect(r?.fetchPriority).toBe('low');
  });

  it('alt cascade : si customAlt absent, prend media.alt', async () => {
    const c = await setupComponent();
    const m = await setupMedia('m2', 'Alt depuis Media');
    await upsertBinding({
      componentId: c.id,
      slot: 'primary',
      mediaId: m.id,
      isActive: true,
    });
    const r = await resolveComponentSlot('home-hero', 'primary');
    expect(r?.alt).toBe('Alt depuis Media');
  });

  it('inclut l’animation par défaut quand un binding default est rattaché', async () => {
    const c = await setupComponent();
    const a = await upsertAnimationFromSeed(ANIM_SEED);
    await upsertAnimationBinding({
      componentId: c.id,
      animationId: a.id,
      isDefault: true,
    });
    const r = await resolveComponentSlot('home-hero', 'primary');
    expect(r?.animation?.key).toBe('fade-in');
  });
});

describe('resolveComponentSlots', () => {
  it('retourne un résultat par slot du composant', async () => {
    await setupComponent();
    const all = await resolveComponentSlots('home-hero');
    expect(all.map((r) => r.slot?.key)).toEqual(['primary', 'badge']);
  });

  it('retourne [] pour un composant inconnu', async () => {
    expect(await resolveComponentSlots('inconnu')).toEqual([]);
  });
});
