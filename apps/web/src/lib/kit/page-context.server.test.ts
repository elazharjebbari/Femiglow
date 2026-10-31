/**
 * Contexte des pages /kit — drapeau « images par audience », aperçu
 * brouillon admin et paramètres de tracking.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(async () => null),
}));
vi.mock('@/lib/components/field-resolver', () => ({
  resolveComponentFields: vi.fn(async () => ({})),
}));
// Galerie simulée : on vérifie ce que le contexte lui demande ; le calcul de
// la valeur de tracking (`kitHeroGalleryTracking`) reste le vrai.
vi.mock('@/lib/products/kit-hero-gallery', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/products/kit-hero-gallery')>()),
  getKitHeroGallery: vi.fn(async (opts: { flagEnabled: boolean }) =>
    opts.flagEnabled
      ? {
          images: [],
          trace: {},
          trackingValue: 'angle-e.fr.v2',
          level: 1,
          variantsEnabled: true,
          draft: (opts as { draft?: boolean }).draft === true,
        }
      : { images: [], trace: {}, trackingValue: 'legacy', level: 7, variantsEnabled: false, draft: false },
  ),
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { resolveComponentFields } from '@/lib/components/field-resolver';
import { getKitHeroGallery } from '@/lib/products/kit-hero-gallery';
import {
  isDraftPreviewRequested,
  readHeroMediaVariantsCmsEnabled,
  resolveHeroMediaVariantsFlag,
  resolveKitPageContext,
  type ResolveKitPageContextInput,
} from './page-context.server';

const product = {
  id: 'kit-femiglow',
  images: [{ src: '/products/kit.png', alt: 'Pack', width: 1200, height: 1500 }],
};

function cookieJar(values: Record<string, string> = {}) {
  return {
    get: (name: string) => (name in values ? { value: values[name]! } : undefined),
  };
}

function cmsEnabled(value: unknown) {
  vi.mocked(resolveComponentFields).mockResolvedValue({
    mediaVariantsEnabled: { value, meta: { source: 'binding', version: 1, locale: 'fr' } },
  } as never);
}

function run(overrides: Partial<ResolveKitPageContextInput> = {}) {
  return resolveKitPageContext({
    locale: 'fr',
    cookies: cookieJar(),
    product,
    envValue: undefined,
    ...overrides,
  });
}

function lastGalleryCall() {
  return vi.mocked(getKitHeroGallery).mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  // `envValue: undefined` retombe sur process.env : on la neutralise.
  vi.stubEnv('HERO_MEDIA_VARIANTS', '');
  vi.mocked(getAdminSession).mockReset();
  vi.mocked(getAdminSession).mockResolvedValue(null);
  vi.mocked(resolveComponentFields).mockReset();
  vi.mocked(resolveComponentFields).mockResolvedValue({});
  vi.mocked(getKitHeroGallery).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveKitPageContext — drapeau', () => {
  it('env absente : drapeau coupé, CMS non lu, view_item sans hero_media_*', async () => {
    cmsEnabled(true);
    const ctx = await run({ searchParams: { angle: 'e' } });
    expect(ctx.heroMediaVariantsEnabled).toBe(false);
    expect(resolveComponentFields).not.toHaveBeenCalled();
    expect(await ctx.heroMediaTracking).toBeNull();
    expect(await ctx.viewItemParams).toEqual({ kit_angle: 'e' });
    expect(ctx.shouldServerFire).toBe(true);
    expect(lastGalleryCall()).toMatchObject({ flagEnabled: false, draft: false, angle: 'e' });
  });

  it('env on + CMS false (défaut) : coupé', async () => {
    cmsEnabled(false);
    const ctx = await run({ envValue: 'on' });
    expect(ctx.heroMediaVariantsEnabled).toBe(false);
    expect(resolveComponentFields).toHaveBeenCalledWith('kit-hero-produit', 'fr');
    expect(await ctx.viewItemParams).toEqual({ kit_angle: 'none' });
  });

  it('env on + CMS true : actif, galerie résolue pour la langue et l’angle, tracking émis', async () => {
    cmsEnabled(true);
    const ctx = await run({
      locale: 'ar',
      envValue: 'on',
      searchParams: { utm_content: 'E-darija' },
      fallbackAlt: 'باك',
    });
    expect(ctx.heroMediaVariantsEnabled).toBe(true);
    // Coupe-circuit global : lu en langue par défaut même sur /ar.
    expect(resolveComponentFields).toHaveBeenCalledWith('kit-hero-produit', 'fr');
    expect(lastGalleryCall()).toMatchObject({
      locale: 'ar',
      angle: 'e',
      flagEnabled: true,
      draft: false,
      fallbackAlt: 'باك',
      productId: 'kit-femiglow',
      maxTotal: 7,
      productFallback: { src: '/products/kit.png', alt: 'Pack', width: 1200, height: 1500 },
    });
    expect(await ctx.heroMediaTracking).toEqual({ variant: 'angle-e.fr.v2', level: 1 });
    expect(await ctx.viewItemParams).toEqual({
      kit_angle: 'e',
      hero_media_variant: 'angle-e.fr.v2',
      hero_media_level: 1,
    });
  });

  it('?hmv=off coupe même si env et CMS sont actifs', async () => {
    cmsEnabled(true);
    const ctx = await run({ envValue: 'on', searchParams: { hmv: 'off' } });
    expect(ctx.heroMediaVariantsEnabled).toBe(false);
    expect(await ctx.viewItemParams).not.toHaveProperty('hero_media_variant');
  });

  it('CMS valeur non booléenne ou lecture en erreur : coupé', async () => {
    cmsEnabled('true');
    expect((await run({ envValue: 'on' })).heroMediaVariantsEnabled).toBe(false);
    vi.mocked(resolveComponentFields).mockRejectedValue(new Error('db down'));
    expect((await run({ envValue: 'on' })).heroMediaVariantsEnabled).toBe(false);
  });

  it('angle repris du cookie fg_angle', async () => {
    const ctx = await run({ cookies: cookieJar({ fg_angle: 'b' }) });
    expect(ctx.kitAngle).toEqual({ angle: 'b', source: 'cookie' });
    expect(lastGalleryCall()).toMatchObject({ angle: 'b' });
  });
});

describe('resolveKitPageContext — aperçu brouillon admin', () => {
  it('sans ?hmv_preview : la session n’est même pas lue', async () => {
    await run();
    expect(getAdminSession).not.toHaveBeenCalled();
  });

  it('?hmv_preview=draft SANS session : ignoré (page publique normale)', async () => {
    const ctx = await run({ searchParams: { hmv_preview: 'draft' } });
    expect(getAdminSession).toHaveBeenCalledTimes(1);
    expect(ctx.draftPreview).toBe(false);
    expect(ctx.heroMediaVariantsEnabled).toBe(false);
    expect(ctx.shouldServerFire).toBe(true);
    expect(lastGalleryCall()).toMatchObject({ flagEnabled: false, draft: false });
  });

  it('session en erreur : ignoré', async () => {
    vi.mocked(getAdminSession).mockRejectedValue(new Error('bad cookie'));
    const ctx = await run({ searchParams: { hmv_preview: 'draft' } });
    expect(ctx.draftPreview).toBe(false);
  });

  it('aperçu admin : cookie fg_angle ignoré, seule l’URL décide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ sub: 'admin' } as never);
    const ctx = await run({ searchParams: { hmv_preview: 'draft' }, cookies: cookieJar({ fg_angle: 'e' }) });
    expect(ctx.kitAngle.angle).toBeNull();
    expect(lastGalleryCall()).toMatchObject({ angle: null, draft: true });
  });

  it('?hmv_preview=draft sans session : cookie fg_angle conservé', async () => {
    const ctx = await run({ searchParams: { hmv_preview: 'draft' }, cookies: cookieJar({ fg_angle: 'e' }) });
    expect(ctx.kitAngle).toEqual({ angle: 'e', source: 'cookie' });
  });

  it('?hmv_preview=draft AVEC session : brouillons, drapeau forcé, aucun serverFire', async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ sub: 'admin' } as never);
    const ctx = await run({ searchParams: { hmv_preview: 'draft', angle: 'e' } });
    expect(ctx.draftPreview).toBe(true);
    // Env absente et CMS coupé : l'aperçu permet de relire AVANT d'activer.
    expect(ctx.heroMediaVariantsEnabled).toBe(true);
    expect(resolveComponentFields).not.toHaveBeenCalled();
    expect(lastGalleryCall()).toMatchObject({ flagEnabled: true, draft: true, angle: 'e' });
    expect(ctx.shouldServerFire).toBe(false);
    // Galerie brouillon affichée, mais variante jamais exposée au tracking
    // (ni attributs data-hero-media-*, ni paramètres).
    expect((await ctx.heroGallery).draft).toBe(true);
    expect(await ctx.heroMediaTracking).toBeNull();
    expect(await ctx.viewItemParams).toEqual({ kit_angle: 'e' });
  });

  it('aperçu + ?hmv=off : galerie historique, toujours sans serverFire', async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ sub: 'admin' } as never);
    const ctx = await run({ searchParams: { hmv_preview: 'draft', hmv: 'off' } });
    expect(ctx.heroMediaVariantsEnabled).toBe(false);
    expect(lastGalleryCall()).toMatchObject({ flagEnabled: false, draft: false });
    expect(ctx.shouldServerFire).toBe(false);
  });
});

describe('resolveKitPageContext — galerie lancée sans bloquer', () => {
  it('le contexte est rendu AVANT la fin de la galerie (promesse en parallèle)', async () => {
    let release!: (g: unknown) => void;
    vi.mocked(getKitHeroGallery).mockImplementationOnce(
      () => new Promise((resolve) => (release = resolve as (g: unknown) => void)) as never,
    );
    const ctx = await run();
    let settled = false;
    void ctx.heroGallery.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    release({ images: [], trace: {}, trackingValue: 'legacy', level: 7, variantsEnabled: false, draft: false });
    await ctx.heroGallery;
    expect(settled).toBe(true);
    expect(await ctx.viewItemParams).toEqual({ kit_angle: 'none' });
  });

  it('galerie en erreur : pas de rejet non géré, l’erreur reste visible pour le hero', async () => {
    vi.mocked(getKitHeroGallery).mockImplementationOnce(() => Promise.reject(new Error('db')) as never);
    const ctx = await run();
    await expect(ctx.heroGallery).rejects.toThrow('db');
    await expect(ctx.viewItemParams).rejects.toThrow('db');
  });
});

describe('helpers', () => {
  it('isDraftPreviewRequested', () => {
    expect(isDraftPreviewRequested(undefined)).toBe(false);
    expect(isDraftPreviewRequested({ hmv_preview: 'draft' })).toBe(true);
    expect(isDraftPreviewRequested({ hmv_preview: ' DRAFT ' })).toBe(true);
    expect(isDraftPreviewRequested({ hmv_preview: ['draft', 'x'] })).toBe(true);
    expect(isDraftPreviewRequested({ hmv_preview: 'published' })).toBe(false);
  });

  it('readHeroMediaVariantsCmsEnabled : strictement true', async () => {
    cmsEnabled(true);
    expect(await readHeroMediaVariantsCmsEnabled()).toBe(true);
    vi.mocked(resolveComponentFields).mockResolvedValue({});
    expect(await readHeroMediaVariantsCmsEnabled()).toBe(false);
  });

  it('resolveHeroMediaVariantsFlag : env × CMS × ?hmv', async () => {
    cmsEnabled(true);
    expect(await resolveHeroMediaVariantsFlag({ envValue: undefined })).toBe(false);
    expect(await resolveHeroMediaVariantsFlag({ envValue: 'off' })).toBe(false);
    expect(await resolveHeroMediaVariantsFlag({ envValue: 'ON' })).toBe(true);
    expect(await resolveHeroMediaVariantsFlag({ envValue: '1', queryOverride: 'off' })).toBe(false);
  });
});
