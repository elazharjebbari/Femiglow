/**
 * Tests unitaires — queries `site_components` (memoryStore backend).
 */
import { beforeEach, describe, it, expect } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import {
  upsertSiteComponentFromSeed,
  getSiteComponentByKey,
  getSiteComponentById,
  listSiteComponents,
  listSiteComponentsByGroup,
  updateSiteComponent,
  findSlot,
  countSiteComponents,
} from './site-components';
import type { SiteComponentSeed } from '@/lib/components/registry';

const SEED_HOME: SiteComponentSeed = {
  key: 'home-hero',
  name: 'Hero Accueil',
  description: 'Hero principal de la home',
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
  ],
  defaultSvgFallback: '/svg/hero.svg',
  defaultLoadingStrategy: 'eager',
  defaultFetchPriority: 'high',
  supportsAnimation: true,
  metadata: { variant: 'editorial' },
};

const SEED_KIT: SiteComponentSeed = {
  key: 'kit-packshot',
  name: 'Packshot Kit',
  description: 'Vue packshot du kit',
  category: 'card',
  pageGroup: 'kit',
  filePath: 'src/components/sections/KitPackshot.tsx',
  slots: [
    {
      key: 'hero',
      label: 'Visuel produit',
      required: true,
      acceptKinds: ['image'],
    },
  ],
  defaultSvgFallback: null,
  defaultLoadingStrategy: 'viewport',
  defaultFetchPriority: 'auto',
  supportsAnimation: true,
};

beforeEach(() => {
  resetMemoryStore();
});

describe('upsertSiteComponentFromSeed', () => {
  it('crée un composant si la clé est inconnue', async () => {
    const created = await upsertSiteComponentFromSeed(SEED_HOME);
    expect(created.id).toMatch(/^cmp_/);
    expect(created.key).toBe('home-hero');
    expect(created.metadata).toEqual({ variant: 'editorial' });
  });

  it('met à jour le composant existant et préserve les clés metadata custom', async () => {
    const first = await upsertSiteComponentFromSeed(SEED_HOME);
    // Simule une clé metadata custom posée par admin
    await updateSiteComponent(first.id, {
      metadata: { adminNote: 'verrouillé' },
    });
    const updated = await upsertSiteComponentFromSeed({
      ...SEED_HOME,
      description: 'Nouvelle description',
    });
    expect(updated.id).toBe(first.id);
    expect(updated.description).toBe('Nouvelle description');
    expect(updated.metadata.adminNote).toBe('verrouillé');
  });
});

describe('getSiteComponentByKey / getSiteComponentById', () => {
  it('retrouve un composant par clé puis par id', async () => {
    const created = await upsertSiteComponentFromSeed(SEED_HOME);
    expect(await getSiteComponentByKey('home-hero')).toMatchObject({ id: created.id });
    expect(await getSiteComponentById(created.id)).toMatchObject({ key: 'home-hero' });
  });

  it('retourne null si la clé n’existe pas', async () => {
    expect(await getSiteComponentByKey('inexistant')).toBeNull();
  });
});

describe('listSiteComponents / listSiteComponentsByGroup', () => {
  it('liste tous les composants triés par pageGroup puis name', async () => {
    await upsertSiteComponentFromSeed(SEED_HOME);
    await upsertSiteComponentFromSeed(SEED_KIT);
    const all = await listSiteComponents();
    expect(all.map((c) => c.key)).toEqual(['home-hero', 'kit-packshot']);
  });

  it('filtre par pageGroup', async () => {
    await upsertSiteComponentFromSeed(SEED_HOME);
    await upsertSiteComponentFromSeed(SEED_KIT);
    const homes = await listSiteComponents({ pageGroup: 'home' });
    expect(homes).toHaveLength(1);
    expect(homes[0]?.key).toBe('home-hero');
  });

  it('listSiteComponentsByGroup partitionne par pageGroup', async () => {
    await upsertSiteComponentFromSeed(SEED_HOME);
    await upsertSiteComponentFromSeed(SEED_KIT);
    const grouped = await listSiteComponentsByGroup();
    expect(grouped.home?.[0]?.key).toBe('home-hero');
    expect(grouped.kit?.[0]?.key).toBe('kit-packshot');
  });
});

describe('findSlot', () => {
  it('retrouve une slot par clé (composant + slot)', async () => {
    await upsertSiteComponentFromSeed(SEED_HOME);
    const slot = await findSlot('home-hero', 'primary');
    expect(slot?.label).toBe('Visuel principal');
  });

  it('retourne null si slot key inconnue', async () => {
    await upsertSiteComponentFromSeed(SEED_HOME);
    expect(await findSlot('home-hero', 'inconnue')).toBeNull();
  });

  it('retourne null si la clé du composant est inconnue', async () => {
    expect(await findSlot('inexistant', 'primary')).toBeNull();
  });
});

describe('countSiteComponents', () => {
  it('reflète le nombre de composants en mémoire', async () => {
    expect(await countSiteComponents()).toBe(0);
    await upsertSiteComponentFromSeed(SEED_HOME);
    await upsertSiteComponentFromSeed(SEED_KIT);
    expect(await countSiteComponents()).toBe(2);
  });
});

describe('updateSiteComponent', () => {
  it('met à jour les champs admin sans toucher aux slots', async () => {
    const c = await upsertSiteComponentFromSeed(SEED_HOME);
    const updated = await updateSiteComponent(c.id, {
      description: 'patch description',
      defaultLoadingStrategy: 'viewport',
      metadata: { custom: true },
    });
    expect(updated?.description).toBe('patch description');
    expect(updated?.defaultLoadingStrategy).toBe('viewport');
    expect(updated?.metadata).toMatchObject({ variant: 'editorial', custom: true });
  });

  it('retourne null pour un id inconnu', async () => {
    expect(await updateSiteComponent('cmp_xxx', { description: 'nope' })).toBeNull();
  });
});
