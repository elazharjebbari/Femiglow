/**
 * Tests `KitPackEditor` — admin form pour la section pack.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { KitPackEditor } from './KitPackEditor';
import type { KitPackOverride } from '@/lib/kit/pack/types';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as unknown as { fetch: typeof fetch }).fetch =
    fetchMock as unknown as typeof fetch;
});

afterEach(() => cleanup());

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function override(over: Partial<KitPackOverride> = {}): KitPackOverride {
  return {
    id: 'kit:pack',
    kicker: 'Le pack',
    title: null,
    lead: null,
    pricePrefix: null,
    ctaLabel: 'Custom',
    ctaMicrocopy: null,
    priceCompareAt: null,
    priceCompareAtAriaLabel: null,
    valueBreakdown: null,
    perUsageHint: null,
    ctaAccent: 'sauge-dark',
    countLabelGeo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    draftedAt: new Date(),
    createdBy: null,
    ...over,
  };
}

describe('KitPackEditor — rendu', () => {
  it('affiche statut « Mock par défaut » quand source=mock', () => {
    render(<KitPackEditor initial={null} source="mock" />);
    expect(screen.getByTestId('kit-pack-status').textContent).toMatch(/Mock/);
  });

  it('affiche « Brouillon » quand source=override-draft', () => {
    render(<KitPackEditor initial={override()} source="override-draft" />);
    expect(screen.getByTestId('kit-pack-status').textContent).toMatch(
      /Brouillon/,
    );
  });

  it('affiche « Publié » quand override publié', () => {
    render(
      <KitPackEditor
        initial={override({ publishedAt: new Date(), draftedAt: null })}
        source="override-published"
      />,
    );
    expect(screen.getByTestId('kit-pack-status').textContent).toMatch(
      /Publié/,
    );
  });

  it('pré-remplit les champs depuis l’override initial', () => {
    render(<KitPackEditor initial={override()} source="override-draft" />);
    expect(
      (screen.getByLabelText(/Libellé CTA/i) as HTMLInputElement).value,
    ).toBe('Custom');
    expect(
      (screen.getByLabelText(/Kicker/i) as HTMLInputElement).value,
    ).toBe('Le pack');
  });
});

describe('KitPackEditor — validation + save', () => {
  it('Save désactivé si pas dirty', () => {
    render(<KitPackEditor initial={null} source="mock" />);
    expect(
      (screen.getByTestId('kit-pack-save') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('Save désactivé si microcopy CTA < 8 mots', () => {
    render(<KitPackEditor initial={null} source="mock" />);
    fireEvent.change(screen.getByLabelText(/Microcopy CTA/i), {
      target: { value: 'Trop court' },
    });
    expect(
      (screen.getByTestId('kit-pack-save') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('Save → PATCH appelé + success affiché', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ override: override({ ctaLabel: 'Nouveau' }) }),
    );
    render(<KitPackEditor initial={null} source="mock" />);
    fireEvent.change(screen.getByLabelText(/Libellé CTA/i), {
      target: { value: 'Nouveau' },
    });
    fireEvent.click(screen.getByTestId('kit-pack-save'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/admin/kit/pack');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('PATCH');
    await waitFor(() =>
      expect(screen.getByTestId('kit-pack-success').textContent).toMatch(
        /enregistré/i,
      ),
    );
  });
});

describe('KitPackEditor — Publish', () => {
  it('Publish désactivé en mode mock', () => {
    render(<KitPackEditor initial={null} source="mock" />);
    expect(
      (screen.getByTestId('kit-pack-publish') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('Publish appelle POST /publish', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        override: override({ publishedAt: new Date(), draftedAt: null }),
      }),
    );
    render(<KitPackEditor initial={override()} source="override-draft" />);
    fireEvent.click(screen.getByTestId('kit-pack-publish'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/admin/kit/pack/publish');
    await waitFor(() =>
      expect(screen.getByTestId('kit-pack-success').textContent).toMatch(
        /Publié/i,
      ),
    );
  });
});

describe('KitPackEditor — Reset', () => {
  it('ouvre la modale + exige saisie RESET-PACK', () => {
    render(<KitPackEditor initial={override()} source="override-draft" />);
    fireEvent.click(screen.getByTestId('kit-pack-reset-open'));
    expect(screen.getByTestId('kit-pack-reset-dialog')).toBeDefined();
    expect(
      (screen.getByTestId('kit-pack-reset-confirm') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('confirme reset avec mot correct → POST /reset', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    render(<KitPackEditor initial={override()} source="override-draft" />);
    fireEvent.click(screen.getByTestId('kit-pack-reset-open'));
    fireEvent.change(screen.getByTestId('kit-pack-reset-input'), {
      target: { value: 'RESET-PACK' },
    });
    fireEvent.click(screen.getByTestId('kit-pack-reset-confirm'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/admin/kit/pack/reset');
  });
});
