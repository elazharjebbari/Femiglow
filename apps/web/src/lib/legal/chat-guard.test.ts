import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/legal/repository', () => ({
  listPublishedSlugs: vi.fn(),
}));

import { listPublishedSlugs } from '@/lib/legal/repository';
import { sanitizeLegalLinksInText, validateLegalSlug } from './chat-guard';

const mockedList = vi.mocked(listPublishedSlugs);

describe('legal/chat-guard — validateLegalSlug', () => {
  beforeEach(() => {
    mockedList.mockReset();
  });

  it('renvoie exists=true si slug publié', async () => {
    mockedList.mockResolvedValue(['cgv', 'confidentialite']);
    const r = await validateLegalSlug('cgv');
    expect(r).toEqual({ slug: 'cgv', exists: true, suggestion: null });
  });

  it('renvoie une suggestion Levenshtein proche pour typo', async () => {
    mockedList.mockResolvedValue(['mentions-legales', 'cgv']);
    const r = await validateLegalSlug('mentions-legalez');
    expect(r.exists).toBe(false);
    expect(r.suggestion).toBe('mentions-legales');
  });

  it('renvoie suggestion=null si distance trop grande', async () => {
    mockedList.mockResolvedValue(['cgv']);
    const r = await validateLegalSlug('produits-cosmetiques');
    expect(r.exists).toBe(false);
    expect(r.suggestion).toBe(null);
  });

  it('normalise en minuscules + trim', async () => {
    mockedList.mockResolvedValue(['cgv']);
    const r = await validateLegalSlug('  CGV  ');
    expect(r.slug).toBe('cgv');
    expect(r.exists).toBe(true);
  });

  it('si DB unavailable : exists=false, suggestion=null (graceful)', async () => {
    mockedList.mockRejectedValue(new Error('db down'));
    const r = await validateLegalSlug('cgv');
    expect(r).toEqual({ slug: 'cgv', exists: false, suggestion: null });
  });
});

describe('legal/chat-guard — sanitizeLegalLinksInText', () => {
  afterEach(() => mockedList.mockReset());

  it('retourne le texte intact si tous les slugs sont valides', async () => {
    mockedList.mockResolvedValue(['cgv', 'confidentialite']);
    const txt = 'Voir /legal/cgv et /legal/confidentialite pour plus.';
    expect(await sanitizeLegalLinksInText(txt)).toBe(txt);
  });

  it("remplace un slug invalide par sa suggestion", async () => {
    mockedList.mockResolvedValue(['mentions-legales']);
    const txt = 'Voir /legal/mentions-legalez pour plus.';
    const out = await sanitizeLegalLinksInText(txt);
    expect(out).toContain('/legal/mentions-legales');
    expect(out).not.toContain('/legal/mentions-legalez');
  });

  it("retire le lien si aucune suggestion plausible", async () => {
    mockedList.mockResolvedValue(['cgv']);
    const out = await sanitizeLegalLinksInText('Voir /legal/abracadabra svp');
    expect(out).toContain('[lien retiré]');
    expect(out).not.toContain('/legal/abracadabra');
  });

  it("ne touche pas un texte sans lien /legal/", async () => {
    const txt = 'Aucun lien ici.';
    expect(await sanitizeLegalLinksInText(txt)).toBe(txt);
    expect(mockedList).not.toHaveBeenCalled();
  });
});
