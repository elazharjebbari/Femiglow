/**
 * HeroProduitBound — galerie du hero (images par audience, PR 4).
 *
 * Le composant serveur est appelé directement : on inspecte les props
 * transmises à `HeroProduit` (mocké) plutôt que le HTML.
 */
import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('./HeroProduit', () => ({ HeroProduit: () => null }));
vi.mock('./StoriesVideoBound', () => ({ StoriesVideoBound: () => null }));
vi.mock('@/lib/components/field-resolver', () => ({
  resolveComponentFields: vi.fn(async () => ({})),
}));
vi.mock('@/lib/auth/require-admin', () => ({ getAdminSession: vi.fn(async () => null) }));
vi.mock('@/lib/products/reviews', () => ({ getKitReviewStats: vi.fn(async () => null) }));
vi.mock('@/lib/kit/cta-copy.server', () => ({
  resolveKitCtaCopy: vi.fn(async () => ({ primary: 'Je commande — {price}', microcopy: '' })),
}));
vi.mock('@/lib/products/kit-hero-gallery', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/products/kit-hero-gallery')>()),
  getKitHeroGallery: vi.fn(),
}));

import { mockKitPageContent } from '@/data/mock/kit';
import { getKitHeroGallery, type KitHeroGallery } from '@/lib/products/kit-hero-gallery';
import { resolveComponentFields } from '@/lib/components/field-resolver';
import { HeroProduitBound } from './HeroProduitBound';

const product = mockKitPageContent.product;

function gallery(overrides: Partial<KitHeroGallery> = {}): KitHeroGallery {
  return {
    images: [{ id: 'g', src: '/g.jpg', alt: 'g', width: 1200, height: 1500, kind: 'product' }],
    trace: {
      primary: { slot: 'primary', level: 7, setId: null, variantDim: null, variantKey: null, locale: null, version: null },
      secondary: { slot: 'secondary', level: 7, setId: null, variantDim: null, variantKey: null, locale: null, version: null },
    },
    trackingValue: 'legacy',
    level: 7,
    variantsEnabled: false,
    draft: false,
    ...overrides,
  };
}

type Props = Record<string, unknown>;

async function renderBound(
  props: Partial<Parameters<typeof HeroProduitBound>[0]> = {},
): Promise<{ hero: Props; links: Props[] }> {
  const root = (await HeroProduitBound({
    componentKey: 'kit-hero-produit',
    product,
    reassurances: mockKitPageContent.reassurances,
    reviewStats: null,
    ...props,
  })) as ReactElement<{ children: ReactNode }>;
  const children = Children.toArray(root.props.children).filter(isValidElement) as Array<
    ReactElement<Props>
  >;
  return {
    hero: children.find((c) => c.type !== 'link')!.props,
    links: children.filter((c) => c.type === 'link').map((c) => c.props),
  };
}

async function heroProps(props: Partial<Parameters<typeof HeroProduitBound>[0]> = {}) {
  return (await renderBound(props)).hero;
}

/**
 * Rend des `<link>` avec le React canary EMBARQUÉ par Next (celui de l'App
 * Router), dans un processus Node séparé (alias `react` → compilé de Next) :
 * vérifie que React les hisse dans `<head>` en conservant `media`.
 */
function renderWithNextCanary(links: Props[]): string {
  const script = `
    const Module = require('module');
    const orig = Module._resolveFilename;
    Module._resolveFilename = function (r, ...a) {
      if (r === 'react' || r.startsWith('react/')) r = r.replace(/^react/, 'next/dist/compiled/react');
      if (r === 'react-dom' || r.startsWith('react-dom/')) r = r.replace(/^react-dom/, 'next/dist/compiled/react-dom');
      return orig.call(this, r, ...a);
    };
    const React = require('react');
    const { renderToString } = require('react-dom/server.node');
    const h = React.createElement;
    const links = JSON.parse(process.argv[1]).map((p, i) => h('link', { ...p, key: i }));
    process.stdout.write(renderToString(
      h('html', null, h('head', null), h('body', null, h('section', null, ...links, h('p', null, 'hero'))))
    ));
  `;
  // Le canary attend la casse camelCase de `fetchPriority` (React 19).
  const normalized = links.map(({ fetchpriority, ...rest }) =>
    fetchpriority ? { ...rest, fetchPriority: fetchpriority } : rest,
  );
  return execFileSync(process.execPath, ['-e', script, JSON.stringify(normalized)], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

beforeEach(() => {
  vi.stubEnv('HERO_MEDIA_VARIANTS', '');
  vi.mocked(getKitHeroGallery).mockReset();
  vi.mocked(getKitHeroGallery).mockResolvedValue(gallery());
  vi.mocked(resolveComponentFields).mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('HeroProduitBound — galerie', () => {
  it('sans galerie fournie, drapeau coupé : galerie historique, aucun tracking', async () => {
    const props = await heroProps({ kitAngle: 'e', locale: 'ar', displayName: 'باك' });
    expect(getKitHeroGallery).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getKitHeroGallery).mock.calls[0]![0]).toMatchObject({
      productId: product.id,
      maxTotal: 7,
      locale: 'ar',
      angle: 'e',
      flagEnabled: false,
      fallbackAlt: 'باك',
      productFallback: {
        src: product.images[0]!.src,
        alt: product.images[0]!.alt,
        width: product.images[0]!.width,
        height: product.images[0]!.height,
      },
    });
    expect(props.galleryImages).toEqual(gallery().images);
    expect(props.heroMediaTracking).toBeNull();
  });

  it('drapeau coupé : aucun <link> de preload ajouté (HTML inchangé)', async () => {
    const { links } = await renderBound();
    expect(links).toEqual([]);
  });

  it('galerie fournie par la page : réutilisée telle quelle (pas de 2e résolution)', async () => {
    const provided = gallery({ trackingValue: 'angle-e.fr.v2', level: 1, variantsEnabled: true });
    const props = await heroProps({ heroGallery: provided, kitAngle: 'e' });
    expect(getKitHeroGallery).not.toHaveBeenCalled();
    expect(props.galleryImages).toBe(provided.images);
    expect(props.heroMediaTracking).toEqual({ variant: 'angle-e.fr.v2', level: 1 });
  });

  it('galerie fournie en promesse (lancée par la page) : attendue, pas recalculée', async () => {
    const provided = gallery({ trackingValue: 'default.fr.v1', level: 4, variantsEnabled: true });
    const props = await heroProps({ heroGallery: Promise.resolve(provided) });
    expect(getKitHeroGallery).not.toHaveBeenCalled();
    expect(props.galleryImages).toBe(provided.images);
    expect(props.heroMediaTracking).toEqual({ variant: 'default.fr.v1', level: 4 });
  });

  it('galerie brouillon (aperçu admin) : affichée, mais aucun tracking exposé', async () => {
    const provided = gallery({ trackingValue: 'angle-e.fr.v3', level: 1, variantsEnabled: true, draft: true });
    const props = await heroProps({ heroGallery: provided });
    expect(props.galleryImages).toBe(provided.images);
    expect(props.heroMediaTracking).toBeNull();
  });

  it('env on + CMS on, sans galerie fournie : résolue drapeau actif', async () => {
    vi.stubEnv('HERO_MEDIA_VARIANTS', 'on');
    vi.mocked(resolveComponentFields).mockResolvedValue({
      mediaVariantsEnabled: { value: true, meta: { source: 'binding', version: 1, locale: 'fr' } },
    } as never);
    await heroProps({ kitAngle: 'b' });
    expect(vi.mocked(getKitHeroGallery).mock.calls[0]![0]).toMatchObject({ flagEnabled: true, angle: 'b' });
  });

  it('image principale art-dirigée : un <link rel=preload> par media query, hissés dans <head>', async () => {
    const provided = gallery({
      variantsEnabled: true,
      level: 1,
      trackingValue: 'angle-e.fr.v2',
      images: [
        {
          id: 'm',
          src: '/_media/d.webp',
          alt: 'a',
          width: 1200,
          height: 1500,
          kind: 'product',
          mobile: { src: '/_media/m.webp', width: 1200, height: 1600 },
        },
      ],
    });
    const { links } = await renderBound({ heroGallery: provided });
    expect(links).toHaveLength(2);
    const [mobile, desktop] = links;
    expect(mobile).toMatchObject({ rel: 'preload', as: 'image', media: '(max-width: 1023px)', imageSizes: '100vw' });
    expect(String(mobile!.imageSrcSet)).toContain(encodeURIComponent('/_media/m.webp'));
    expect(String(mobile!.imageSrcSet)).not.toContain(encodeURIComponent('/_media/d.webp'));
    // `href` de repli : candidat moyen (828w), jamais le 3840w.
    expect(String(mobile!.href)).toContain('w=828');
    expect(desktop).toMatchObject({ media: '(min-width: 1024px)' });
    expect(String(desktop!.imageSrcSet)).toContain(encodeURIComponent('/_media/d.webp'));
    expect(String(desktop!.href)).toContain('w=1200');

    // Rendu réel par le React canary de Next : hissés dans <head>, `media` conservé.
    const html = renderWithNextCanary(links);
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
    const body = html.slice(html.indexOf('<body>'));
    expect(head.match(/<link rel="preload" as="image"/g)).toHaveLength(2);
    expect(head).toContain('media="(max-width: 1023px)"');
    expect(head).toContain('media="(min-width: 1024px)"');
    expect(head).toContain('fetchPriority="high"');
    expect(body).not.toContain('<link');
  });
});
