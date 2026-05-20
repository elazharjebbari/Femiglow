/**
 * Tests `KitCompositionEditor` — admin form pour un sous-produit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { KitCompositionEditor } from './KitCompositionEditor';
import { mockKitPageContent } from '@/data/mock/kit';
import type { KitCompositionOverride } from '@/lib/kit/composition/types';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as any).fetch = fetchMock;
});

afterEach(() => cleanup());

const paste = mockKitPageContent.composition[0]!;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function override(over: Partial<KitCompositionOverride> = {}): KitCompositionOverride {
  return {
    id: 'kit-composition:1-paste',
    subProductId: '1-paste',
    narrative: 'Test narrative.',
    usageHint: 'test hint',
    accentColor: 'sauge',
    ingredients: null,
    certifications: [{ label: 'A', body: 'B' }],
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    draftedAt: new Date(),
    createdBy: 'adm_1',
    ...over,
  };
}

describe('KitCompositionEditor — rendu', () => {
  it('affiche le statut « Mock par défaut » quand source=mock', () => {
    render(
      <KitCompositionEditor
        subProductId="1-paste"
        initial={null}
        baseSubProduct={paste}
        source="mock"
      />,
    );
    expect(screen.getByTestId('kit-composition-status').textContent).toMatch(
      /Mock/,
    );
  });

  it('affiche « Brouillon » quand source=override-draft', () => {
    render(
      <KitCompositionEditor
        subProductId="1-paste"
        initial={override()}
        baseSubProduct={paste}
        source="override-draft"
      />,
    );
    expect(screen.getByTestId('kit-composition-status').textContent).toMatch(
      /Brouillon/,
    );
  });

  it('affiche le nom du sous-produit dans le header', () => {
    render(
      <KitCompositionEditor
        subProductId="1-paste"
        initial={null}
        baseSubProduct={paste}
        source="mock"
      />,
    );
    expect(screen.getByText(/1 Paste/)).toBeDefined();
  });
});

describe('KitCompositionEditor — validation live', () => {
  it('refuse narrative sans ponctuation finale', () => {
    render(
      <KitCompositionEditor
        subProductId="1-paste"
        initial={null}
        baseSubProduct={paste}
        source="mock"
      />,
    );
    const textarea = screen.getByPlaceholderText(/12 % de cire/i);
    fireEvent.change(textarea, { target: { value: 'Sans ponctuation' } });
    expect(screen.getByTestId('error-narrative')).toBeDefined();
  });

  it('Save désactivé si invalid', () => {
    render(
      <KitCompositionEditor
        subProductId="1-paste"
        initial={null}
        baseSubProduct={paste}
        source="mock"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/12 % de cire/i), {
      target: { value: 'invalide' },
    });
    expect(
      (screen.getByTestId('kit-composition-save') as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('KitCompositionEditor — Save', () => {
  it('au submit, PATCH appelé et success affiché', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ override: override({ narrative: 'Nouvelle intro.' }) }),
    );
    render(
      <KitCompositionEditor
        subProductId="1-paste"
        initial={null}
        baseSubProduct={paste}
        source="mock"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/12 % de cire/i), {
      target: { value: 'Nouvelle intro.' },
    });
    fireEvent.click(screen.getByTestId('kit-composition-save'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]![0]).toBe(
      '/api/admin/kit/composition/1-paste',
    );
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('PATCH');
    await waitFor(() =>
      expect(screen.getByTestId('kit-composition-success').textContent).toMatch(
        /enregistré/i,
      ),
    );
  });
});

describe('KitCompositionEditor — Publish', () => {
  it('au clic publish appelle POST /publish', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        override: override({ publishedAt: new Date(), draftedAt: null }),
      }),
    );
    render(
      <KitCompositionEditor
        subProductId="1-paste"
        initial={override()}
        baseSubProduct={paste}
        source="override-draft"
      />,
    );
    fireEvent.click(screen.getByTestId('kit-composition-publish'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]![0]).toBe(
      '/api/admin/kit/composition/1-paste/publish',
    );
    await waitFor(() =>
      expect(screen.getByTestId('kit-composition-success').textContent).toMatch(
        /Publié/i,
      ),
    );
  });

  it('Publish désactivé en mode mock', () => {
    render(
      <KitCompositionEditor
        subProductId="1-paste"
        initial={null}
        baseSubProduct={paste}
        source="mock"
      />,
    );
    expect(
      (screen.getByTestId('kit-composition-publish') as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('KitCompositionEditor — Reset', () => {
  it('ouvre la modale + exige saisie RESET-COMPOSITION-1-PASTE', () => {
    render(
      <KitCompositionEditor
        subProductId="1-paste"
        initial={override()}
        baseSubProduct={paste}
        source="override-draft"
      />,
    );
    fireEvent.click(screen.getByTestId('kit-composition-reset-open'));
    expect(screen.getByTestId('kit-composition-reset-dialog')).toBeDefined();
    expect(
      (screen.getByTestId('kit-composition-reset-confirm') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('confirme reset avec mot correct, fetch POST /reset', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    render(
      <KitCompositionEditor
        subProductId="1-paste"
        initial={override()}
        baseSubProduct={paste}
        source="override-draft"
      />,
    );
    fireEvent.click(screen.getByTestId('kit-composition-reset-open'));
    fireEvent.change(screen.getByTestId('kit-composition-reset-input'), {
      target: { value: 'RESET-COMPOSITION-1-PASTE' },
    });
    fireEvent.click(screen.getByTestId('kit-composition-reset-confirm'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]![0]).toBe(
      '/api/admin/kit/composition/1-paste/reset',
    );
  });
});

describe('KitCompositionEditor — certifications', () => {
  it('ajoute une certification vide via + Ajouter', () => {
    render(
      <KitCompositionEditor
        subProductId="1-paste"
        initial={null}
        baseSubProduct={paste}
        source="mock"
      />,
    );
    const initialCount = screen.getAllByTestId(/kit-composition-cert-\d+$/).length;
    fireEvent.click(screen.getByTestId('kit-composition-cert-add'));
    const finalCount = screen.getAllByTestId(/kit-composition-cert-\d+$/).length;
    expect(finalCount).toBe(initialCount + 1);
  });

  it('supprime une certification via ✕', () => {
    render(
      <KitCompositionEditor
        subProductId="1-paste"
        initial={null}
        baseSubProduct={paste}
        source="mock"
      />,
    );
    const initialCount = screen.getAllByTestId(/kit-composition-cert-\d+$/).length;
    fireEvent.click(screen.getByTestId('kit-composition-cert-remove-0'));
    const finalCount = screen.queryAllByTestId(/kit-composition-cert-\d+$/).length;
    expect(finalCount).toBe(initialCount - 1);
  });
});
