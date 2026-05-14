import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/legal/repository', () => ({
  listPlacementsForZone: vi.fn(),
}));

import { listPlacementsForZone } from '@/lib/legal/repository';
import { LegalRelatedLinks } from '../LegalRelatedLinks';

beforeEach(() => {
  vi.mocked(listPlacementsForZone).mockReset();
});

afterEach(() => vi.clearAllMocks());

describe('LegalRelatedLinks', () => {
  it('rend les liens excluant currentSlug', async () => {
    vi.mocked(listPlacementsForZone).mockResolvedValue([
      { pageSlug: 'cgv', title: 'CGV', labelOverride: null, displayOrder: 1 },
      { pageSlug: 'cookies', title: 'Cookies', labelOverride: null, displayOrder: 2 },
      { pageSlug: 'confidentialite', title: 'Confidentialité', labelOverride: null, displayOrder: 3 },
    ]);

    const ui = await LegalRelatedLinks({ currentSlug: 'cgv' });
    const { container } = render(ui as React.ReactElement);
    expect(container.textContent).toContain('Voir aussi');
    expect(container.textContent).toContain('Cookies');
    expect(container.textContent).toContain('Confidentialité');
    // currentSlug exclu
    expect(container.innerHTML).not.toContain('/legal/cgv"');
  });

  it('respecte le limit (4 par défaut)', async () => {
    vi.mocked(listPlacementsForZone).mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        pageSlug: `page-${i}`,
        title: `Page ${i}`,
        labelOverride: null,
        displayOrder: i,
      })),
    );
    const ui = await LegalRelatedLinks({ currentSlug: 'autre' });
    const { container } = render(ui as React.ReactElement);
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(4);
  });

  it('utilise labelOverride si présent', async () => {
    vi.mocked(listPlacementsForZone).mockResolvedValue([
      { pageSlug: 'cgv', title: 'Conditions Générales de Vente', labelOverride: 'CGV (court)', displayOrder: 1 },
    ]);
    const ui = await LegalRelatedLinks({ currentSlug: 'autre' });
    const { container } = render(ui as React.ReactElement);
    expect(container.textContent).toContain('CGV (court)');
    expect(container.textContent).not.toContain('Conditions Générales de Vente');
  });

  it('ne rend rien si 0 lien restant', async () => {
    vi.mocked(listPlacementsForZone).mockResolvedValue([
      { pageSlug: 'cgv', title: 'CGV', labelOverride: null, displayOrder: 1 },
    ]);
    const ui = await LegalRelatedLinks({ currentSlug: 'cgv' });
    expect(ui).toBeNull();
  });

  it('rend rien si DB throw (graceful)', async () => {
    vi.mocked(listPlacementsForZone).mockRejectedValue(new Error('db'));
    const ui = await LegalRelatedLinks({ currentSlug: 'cgv' });
    expect(ui).toBeNull();
  });

  it('a un nav avec aria-labelledby', async () => {
    vi.mocked(listPlacementsForZone).mockResolvedValue([
      { pageSlug: 'cgv', title: 'CGV', labelOverride: null, displayOrder: 1 },
    ]);
    const ui = await LegalRelatedLinks({ currentSlug: 'autre' });
    const { container } = render(ui as React.ReactElement);
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('aria-labelledby')).toBe('related-title');
    expect(container.querySelector('#related-title')).toBeTruthy();
  });
});
