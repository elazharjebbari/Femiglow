/**
 * Tests unitaires — queries `component_media_bindings` (memoryStore).
 *
 * Couvre :
 *  - upsertBinding (insert puis update sur (componentId, slot)).
 *  - getActiveBindingWithMedia (renvoie null si isActive=false).
 *  - setBindingActive / deleteBinding.
 *  - listBindingsWithMediaByComponent (jointure Media).
 */
import { beforeEach, describe, it, expect } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { upsertSiteComponentFromSeed } from './site-components';
import {
  upsertBinding,
  getBindingBySlot,
  getActiveBindingWithMedia,
  listBindingsWithMediaByComponent,
  listBindingsForMedia,
  setBindingActive,
  deleteBinding,
} from './component-bindings';
import { createMedia } from './media';
import type { SiteComponentSeed } from '@/lib/components/registry';

const SEED: SiteComponentSeed = {
  key: 'home-hero',
  name: 'Hero Accueil',
  description: '',
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

beforeEach(() => {
  resetMemoryStore();
});

async function setupComponent() {
  return upsertSiteComponentFromSeed(SEED);
}

async function setupMedia(slug = 'hero-1') {
  return createMedia({
    kind: 'image',
    source: 'upload',
    slug,
    alt: 'Photo hero',
    caption: null,
    credit: null,
    originalFilename: 'hero.png',
    originalMime: 'image/png',
    originalSizeBytes: 1024,
    originalUrl: null,
    qualityProfile: 'hero',
    loadingStrategy: 'eager',
    isHero: true,
    createdBy: null,
  });
}

describe('upsertBinding', () => {
  it('crée un binding (isActive=false par défaut)', async () => {
    const c = await setupComponent();
    const m = await setupMedia();
    const bnd = await upsertBinding({
      componentId: c.id,
      slot: 'primary',
      mediaId: m.id,
    });
    expect(bnd.id).toMatch(/^bnd_/);
    expect(bnd.isActive).toBe(false);
    expect(bnd.loadingStrategy).toBe('viewport');
    expect(bnd.placeholderStrategy).toBe('svg');
  });

  it('upsert sur (componentId, slot) → update au lieu de doublon', async () => {
    const c = await setupComponent();
    const m1 = await setupMedia('m1');
    const m2 = await setupMedia('m2');
    const first = await upsertBinding({
      componentId: c.id,
      slot: 'primary',
      mediaId: m1.id,
    });
    const second = await upsertBinding({
      componentId: c.id,
      slot: 'primary',
      mediaId: m2.id,
      isActive: true,
    });
    expect(second.id).toBe(first.id);
    expect(second.mediaId).toBe(m2.id);
    expect(second.isActive).toBe(true);
  });

  it('persiste loadingStrategy/customAlt fournis', async () => {
    const c = await setupComponent();
    const m = await setupMedia();
    const bnd = await upsertBinding({
      componentId: c.id,
      slot: 'primary',
      mediaId: m.id,
      loadingStrategy: 'idle',
      fetchPriority: 'low',
      customAlt: 'Alt admin',
    });
    expect(bnd.loadingStrategy).toBe('idle');
    expect(bnd.fetchPriority).toBe('low');
    expect(bnd.customAlt).toBe('Alt admin');
  });
});

describe('getBindingBySlot / getActiveBindingWithMedia', () => {
  it('getActiveBindingWithMedia retourne null tant que isActive=false', async () => {
    const c = await setupComponent();
    const m = await setupMedia();
    await upsertBinding({ componentId: c.id, slot: 'primary', mediaId: m.id });
    expect(await getActiveBindingWithMedia(c.id, 'primary')).toBeNull();
  });

  it('getActiveBindingWithMedia retourne {binding, media} si isActive=true', async () => {
    const c = await setupComponent();
    const m = await setupMedia();
    const bnd = await upsertBinding({
      componentId: c.id,
      slot: 'primary',
      mediaId: m.id,
      isActive: true,
    });
    const active = await getActiveBindingWithMedia(c.id, 'primary');
    expect(active?.binding.id).toBe(bnd.id);
    expect(active?.media?.id).toBe(m.id);
  });

  it('getBindingBySlot retourne null si pas de binding', async () => {
    const c = await setupComponent();
    expect(await getBindingBySlot(c.id, 'primary')).toBeNull();
  });
});

describe('listBindingsWithMediaByComponent', () => {
  it('retourne les bindings enrichis (avec ou sans media)', async () => {
    const c = await setupComponent();
    const m = await setupMedia();
    await upsertBinding({ componentId: c.id, slot: 'primary', mediaId: m.id });
    await upsertBinding({ componentId: c.id, slot: 'badge', mediaId: null });
    const list = await listBindingsWithMediaByComponent(c.id);
    expect(list).toHaveLength(2);
    const primary = list.find((b) => b.slot === 'primary');
    expect(primary?.media?.id).toBe(m.id);
    const badge = list.find((b) => b.slot === 'badge');
    expect(badge?.media).toBeNull();
  });
});

describe('setBindingActive / deleteBinding', () => {
  it('setBindingActive bascule isActive', async () => {
    const c = await setupComponent();
    const m = await setupMedia();
    const bnd = await upsertBinding({
      componentId: c.id,
      slot: 'primary',
      mediaId: m.id,
    });
    expect(bnd.isActive).toBe(false);
    await setBindingActive(bnd.id, true);
    const reloaded = await getBindingBySlot(c.id, 'primary');
    expect(reloaded?.isActive).toBe(true);
  });

  it('deleteBinding supprime le binding', async () => {
    const c = await setupComponent();
    const m = await setupMedia();
    const bnd = await upsertBinding({
      componentId: c.id,
      slot: 'primary',
      mediaId: m.id,
    });
    await deleteBinding(bnd.id);
    expect(await getBindingBySlot(c.id, 'primary')).toBeNull();
  });
});

describe('listBindingsForMedia', () => {
  it('liste les bindings qui pointent vers un même media', async () => {
    const c = await setupComponent();
    const m = await setupMedia();
    await upsertBinding({ componentId: c.id, slot: 'primary', mediaId: m.id });
    await upsertBinding({ componentId: c.id, slot: 'badge', mediaId: m.id });
    const list = await listBindingsForMedia(m.id);
    expect(list).toHaveLength(2);
  });
});
