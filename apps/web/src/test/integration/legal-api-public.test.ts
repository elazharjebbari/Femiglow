/**
 * Suite intégration — Routes publiques legal.
 *
 * Couvre :
 *  - GET /api/legal/[slug] : 200 si publié, 404 sinon, cache-control,
 *    rendu HTML sanitized inclus, last_updated_at depuis publishedAt.
 *  - GET /api/legal/placements/[zone] : 200 avec liens, slugs invalides
 *    rejetés, cache-control.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

vi.mock('@/lib/legal/repository', () => ({
  getPublishedLegalPage: vi.fn(),
  listAllTemplateVars: vi.fn(),
  listPlacementsForZone: vi.fn(),
}));

vi.mock('@/lib/legal/redirects', () => ({
  lookupSlugRedirect: vi.fn(),
}));

import {
  getPublishedLegalPage,
  listAllTemplateVars,
  listPlacementsForZone,
} from '@/lib/legal/repository';
import { lookupSlugRedirect } from '@/lib/legal/redirects';

import { GET as getLegalPage } from '@/app/api/legal/[slug]/route';
import { GET as getZonePlacements } from '@/app/api/legal/placements/[zone]/route';

const mockedPage = vi.mocked(getPublishedLegalPage);
const mockedVars = vi.mocked(listAllTemplateVars);
const mockedZone = vi.mocked(listPlacementsForZone);

const PAGE_FIXTURE = {
  id: 'lp_x',
  slug: 'cgv',
  title: 'CGV',
  description: 'Conditions générales',
  bodyMd: '# Titre\n\nSociété **{{COMPANY_NAME}}**.\n\n[lien](https://google.com)',
  status: 'published' as const,
  version: 3,
  includeInSearch: false,
  canonicalUrl: null,
  locale: 'fr-MA' as const,
  requireLegalReview: true,
  lastLegalReviewAt: null,
  lastLegalReviewBy: null,
  submittedAt: null,
  submittedBy: null,
  publishedAt: new Date('2026-05-01T12:00:00Z'),
  publishedBy: 'adm_1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-05-01T12:00:00Z'),
  createdBy: 'adm_1',
  updatedBy: 'adm_1',
};

const VARS_FIXTURE = [
  {
    key: 'COMPANY_NAME',
    value: 'FemiGlow',
    label: '',
    description: null,
    isRequired: true,
    sensitive: false,
    updatedAt: new Date(),
    updatedBy: null,
  },
];

describe('GET /api/legal/[slug]', () => {
  beforeEach(() => {
    mockedPage.mockReset();
    mockedVars.mockReset();
    vi.mocked(lookupSlugRedirect).mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it('200 + rendu HTML + cache-control si publié', async () => {
    mockedPage.mockResolvedValue(PAGE_FIXTURE as never);
    mockedVars.mockResolvedValue(VARS_FIXTURE as never);

    const res = await getLegalPage(new Request('http://x/api/legal/cgv'), {
      params: { slug: 'cgv' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage=300');

    const body = (await res.json()) as {
      slug: string;
      title: string;
      content_html: string;
      version: number;
      last_updated_at: string;
    };
    expect(body.slug).toBe('cgv');
    expect(body.version).toBe(3);
    expect(body.content_html).toContain('FemiGlow');
    expect(body.content_html).toContain('<h1');
    // External link → target=_blank
    expect(body.content_html).toContain('target="_blank"');
  });

  it('404 si la page n\'existe pas / pas publiée', async () => {
    mockedPage.mockResolvedValue(null);
    vi.mocked(lookupSlugRedirect).mockResolvedValue(null);

    const res = await getLegalPage(new Request('http://x/api/legal/inconnue'), {
      params: { slug: 'inconnue' },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('not_found');
  });

  it('301 vers le nouveau slug si la page a été renommée', async () => {
    mockedPage.mockResolvedValue(null);
    vi.mocked(lookupSlugRedirect).mockResolvedValue('conditions-de-vente');

    const res = await getLegalPage(new Request('http://x/api/legal/cgv-old'), {
      params: { slug: 'cgv-old' },
    });
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('/legal/conditions-de-vente');
  });

  it('content_html ne contient pas de <script>', async () => {
    mockedPage.mockResolvedValue({
      ...PAGE_FIXTURE,
      bodyMd: 'OK <script>alert(1)</script> end',
    } as never);
    mockedVars.mockResolvedValue([] as never);
    const res = await getLegalPage(new Request('http://x/api/legal/cgv'), {
      params: { slug: 'cgv' },
    });
    const body = (await res.json()) as { content_html: string };
    expect(body.content_html).not.toContain('<script');
  });
});

describe('GET /api/legal/placements/[zone]', () => {
  beforeEach(() => mockedZone.mockReset());

  it('200 avec liste de liens triée par display_order', async () => {
    mockedZone.mockResolvedValue([
      { pageSlug: 'cgv', title: 'CGV', labelOverride: null, displayOrder: 1 },
      { pageSlug: 'cookies', title: 'Cookies', labelOverride: 'C', displayOrder: 2 },
    ]);

    const res = await getZonePlacements(new Request('http://x'), {
      params: { zone: 'footer-main' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      zone: string;
      links: Array<{ slug: string; label: string; href: string }>;
    };
    expect(body.zone).toBe('footer-main');
    expect(body.links).toHaveLength(2);
    expect(body.links[0]).toEqual({
      slug: 'cgv',
      label: 'CGV',
      href: '/legal/cgv',
      display_order: 1,
    });
    expect(body.links[1]?.label).toBe('C'); // labelOverride prend la priorité
  });

  it('400 si zone-key invalide', async () => {
    const res = await getZonePlacements(new Request('http://x'), {
      params: { zone: 'NoT_a_zone' },
    });
    expect(res.status).toBe(400);
  });

  it('200 avec liste vide', async () => {
    mockedZone.mockResolvedValue([]);
    const res = await getZonePlacements(new Request('http://x'), {
      params: { zone: 'mobile-menu' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { links: unknown[] };
    expect(body.links).toEqual([]);
  });
});
