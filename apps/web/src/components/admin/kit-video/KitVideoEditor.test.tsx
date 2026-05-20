/**
 * Tests `KitVideoEditor` — formulaire admin singleton.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { KitVideoEditor } from './KitVideoEditor';
import type { KitVideoOverride } from '@/lib/kit/video/types';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as any).fetch = fetchMock;
});

afterEach(() => {
  cleanup();
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function override(over: Partial<KitVideoOverride> = {}): KitVideoOverride {
  return {
    id: 'kit:video',
    youtubeUrl: 'https://youtube.com/shorts/N2pDuciP4uQ',
    provenance: 'Filmé à Rabat.',
    durationDisplay: '90″',
    accentColor: 'sauge',
    posterCustom: null,
    chapters: [
      { key: 'paste', label: 'Paste', startSeconds: 0 },
      { key: 'powder', label: 'Powder', startSeconds: 18 },
    ],
    createdAt: new Date('2026-05-01'),
    updatedAt: new Date('2026-05-10'),
    publishedAt: null,
    draftedAt: new Date('2026-05-10'),
    createdBy: 'adm_1',
    ...over,
  };
}

describe('KitVideoEditor — rendu initial', () => {
  it('affiche le statut « Mock par défaut » quand source=mock', () => {
    render(<KitVideoEditor initial={null} source="mock" />);
    expect(screen.getByTestId('kit-video-status').textContent).toMatch(/Mock/);
  });

  it('affiche « Brouillon » quand override-draft', () => {
    render(<KitVideoEditor initial={override()} source="override-draft" />);
    expect(screen.getByTestId('kit-video-status').textContent).toMatch(/Brouillon/);
  });

  it('affiche « Publié » quand override-published sans draft pending', () => {
    render(
      <KitVideoEditor
        initial={override({ publishedAt: new Date(), draftedAt: null })}
        source="override-published"
      />,
    );
    expect(screen.getByTestId('kit-video-status').textContent).toMatch(/Publié/);
  });

  it('pré-remplit youtubeUrl/provenance/durationDisplay depuis l\'override', () => {
    render(<KitVideoEditor initial={override()} source="override-draft" />);
    expect(
      (screen.getByPlaceholderText(/youtube.com/i) as HTMLInputElement).value,
    ).toContain('N2pDuciP4uQ');
    expect(
      (screen.getByPlaceholderText(/Filmé à l/i) as HTMLInputElement).value,
    ).toBe('Filmé à Rabat.');
  });
});

describe('KitVideoEditor — validation live', () => {
  it('affiche une erreur sous youtubeUrl quand URL invalide', () => {
    render(<KitVideoEditor initial={null} source="mock" />);
    const input = screen.getByPlaceholderText(/youtube.com/i);
    fireEvent.change(input, { target: { value: 'https://vimeo.com/123' } });
    expect(screen.getByTestId('error-youtubeUrl')).toBeDefined();
  });

  it('affiche une erreur sous provenance sans ponctuation finale', () => {
    render(<KitVideoEditor initial={null} source="mock" />);
    const input = screen.getByPlaceholderText(/Filmé à l/i);
    fireEvent.change(input, { target: { value: 'Filmé à Rabat' } });
    expect(screen.getByTestId('error-provenance')).toBeDefined();
  });

  it('le bouton Save est désactivé si le formulaire est invalide', () => {
    render(<KitVideoEditor initial={null} source="mock" />);
    fireEvent.change(screen.getByPlaceholderText(/youtube.com/i), {
      target: { value: 'https://vimeo.com/123' },
    });
    expect(
      (screen.getByTestId('kit-video-save') as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('KitVideoEditor — Save (PATCH)', () => {
  it('au submit, appelle PATCH /api/admin/kit/video et affiche success', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ override: override({ provenance: 'Filmé à Rabat.' }) }),
    );
    render(<KitVideoEditor initial={null} source="mock" />);

    fireEvent.change(screen.getByPlaceholderText(/Filmé à l/i), {
      target: { value: 'Filmé à Rabat.' },
    });
    fireEvent.click(screen.getByTestId('kit-video-save'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/admin/kit/video');
    expect((init as RequestInit).method).toBe('PATCH');
    await waitFor(() =>
      expect(screen.getByTestId('kit-video-success').textContent).toMatch(/enregistré/i),
    );
  });

  it('affiche l\'erreur serveur si PATCH retourne 422', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: 'Payload invalide' } }, 422),
    );
    render(<KitVideoEditor initial={override()} source="override-draft" />);
    fireEvent.change(screen.getByPlaceholderText(/Filmé à l/i), {
      target: { value: 'Nouvelle provenance.' },
    });
    fireEvent.click(screen.getByTestId('kit-video-save'));
    await waitFor(() =>
      expect(screen.getByTestId('kit-video-error').textContent).toMatch(/invalide/i),
    );
  });
});

describe('KitVideoEditor — Publish', () => {
  it('au clic, appelle POST /publish et affiche success', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        override: override({ publishedAt: new Date(), draftedAt: null }),
      }),
    );
    render(<KitVideoEditor initial={override()} source="override-draft" />);
    fireEvent.click(screen.getByTestId('kit-video-publish'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/admin/kit/video/publish');
    await waitFor(() =>
      expect(screen.getByTestId('kit-video-success').textContent).toMatch(/Publié/i),
    );
  });

  it('Publish désactivé quand source=mock (rien à publier)', () => {
    render(<KitVideoEditor initial={null} source="mock" />);
    expect(
      (screen.getByTestId('kit-video-publish') as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('KitVideoEditor — Reset', () => {
  it('ouvre la modale et exige la saisie RESET-VIDEO', () => {
    render(<KitVideoEditor initial={override()} source="override-draft" />);
    fireEvent.click(screen.getByTestId('kit-video-reset-open'));
    expect(screen.getByTestId('kit-video-reset-dialog')).toBeDefined();
    expect(
      (screen.getByTestId('kit-video-reset-confirm') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('confirme et appelle POST /reset quand RESET-VIDEO tapé', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    render(<KitVideoEditor initial={override()} source="override-draft" />);
    fireEvent.click(screen.getByTestId('kit-video-reset-open'));
    fireEvent.change(screen.getByTestId('kit-video-reset-input'), {
      target: { value: 'RESET-VIDEO' },
    });
    fireEvent.click(screen.getByTestId('kit-video-reset-confirm'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/admin/kit/video/reset');
    await waitFor(() =>
      expect(screen.getByTestId('kit-video-success').textContent).toMatch(/supprimé/i),
    );
  });

  it('refuse la confirmation si le mot tapé est incorrect', () => {
    render(<KitVideoEditor initial={override()} source="override-draft" />);
    fireEvent.click(screen.getByTestId('kit-video-reset-open'));
    fireEvent.change(screen.getByTestId('kit-video-reset-input'), {
      target: { value: 'reset' },
    });
    expect(
      (screen.getByTestId('kit-video-reset-confirm') as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('KitVideoEditor — chapitres', () => {
  it('ajoute un chapitre via le bouton « + Ajouter chapitre »', () => {
    render(<KitVideoEditor initial={override()} source="override-draft" />);
    expect(screen.getAllByTestId(/kit-video-chapter-\d+$/)).toHaveLength(2);
    fireEvent.click(screen.getByTestId('kit-video-chapter-add'));
    expect(screen.getAllByTestId(/kit-video-chapter-\d+$/)).toHaveLength(3);
  });

  it('supprime un chapitre via la croix', () => {
    render(<KitVideoEditor initial={override()} source="override-draft" />);
    fireEvent.click(screen.getByTestId('kit-video-chapter-remove-1'));
    expect(screen.getAllByTestId(/kit-video-chapter-\d+$/)).toHaveLength(1);
  });

  it('signale une erreur Zod si on retombe à 1 chapitre', () => {
    render(<KitVideoEditor initial={override()} source="override-draft" />);
    fireEvent.click(screen.getByTestId('kit-video-chapter-remove-1'));
    // 1 chapitre restant → schema exige ≥ 2.
    expect(screen.getByTestId('error-chapters')).toBeDefined();
  });
});
