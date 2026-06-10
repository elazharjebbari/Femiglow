/**
 * Tests for CaptionEditor — edits caption + hook with autosave integration.
 *
 * CaptionEditor uses `useDraftAutosave` which requires `<StudioProvider>`.
 * We wrap with `skipInitialFetch` to avoid network calls during rendering.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CaptionEditor, AutosaveIndicator } from './CaptionEditor';
import { StudioProvider } from '@/lib/content-studio-v2/state/StudioContext';
import { buildContentDraft } from '@/test/factories/content-studio';

function renderWithProvider(
  ui: React.ReactElement,
  opts?: { drafts?: ReturnType<typeof buildContentDraft>[] },
) {
  return render(
    <StudioProvider
      skipInitialFetch
      initial={{
        ideas: [],
        drafts: opts?.drafts ?? [buildContentDraft()],
        posts: [],
        jobs: [],
        mediaItems: [],
      }}
    >
      {ui}
    </StudioProvider>,
  );
}

describe('CaptionEditor', () => {
  it('renders with initial caption and hook values', () => {
    renderWithProvider(
      <CaptionEditor
        draftId="draft_test1"
        initialCaption="Ma caption initiale"
        initialHook="Mon accroche"
      />,
    );
    const caption = screen.getByLabelText(/Légende complète/i);
    expect(caption).toHaveValue('Ma caption initiale');
    const hook = screen.getByLabelText(/Accroche du draft/i);
    expect(hook).toHaveValue('Mon accroche');
  });

  it('typing in caption triggers onChange callback', () => {
    const onChange = vi.fn();
    renderWithProvider(
      <CaptionEditor
        draftId="draft_test1"
        initialCaption=""
        initialHook=""
        onChange={onChange}
      />,
    );
    const caption = screen.getByLabelText(/Légende complète/i);
    fireEvent.change(caption, { target: { value: 'Nouveau texte' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ caption: 'Nouveau texte', hook: null }),
    );
  });

  it('typing in hook triggers onChange callback', () => {
    const onChange = vi.fn();
    renderWithProvider(
      <CaptionEditor
        draftId="draft_test1"
        initialCaption="Caption existante"
        initialHook=""
        onChange={onChange}
      />,
    );
    const hook = screen.getByLabelText(/Accroche du draft/i);
    fireEvent.change(hook, { target: { value: 'Nouvelle accroche' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ caption: 'Caption existante', hook: 'Nouvelle accroche' }),
    );
  });

  it('hook field has maxLength=280', () => {
    renderWithProvider(
      <CaptionEditor
        draftId="draft_test1"
        initialCaption=""
        initialHook=""
      />,
    );
    const hook = screen.getByLabelText(/Accroche du draft/i);
    expect(hook).toHaveAttribute('maxLength', '280');
  });

  it('caption character counter updates on type', () => {
    renderWithProvider(
      <CaptionEditor
        draftId="draft_test1"
        initialCaption=""
        initialHook=""
        maxLength={2200}
      />,
    );
    // Initially 0 / 2200
    expect(screen.getByText('0 / 2200')).toBeInTheDocument();
    const caption = screen.getByLabelText(/Légende complète/i);
    fireEvent.change(caption, { target: { value: 'Hello' } });
    expect(screen.getByText('5 / 2200')).toBeInTheDocument();
  });

  it('renders the section with proper aria-label', () => {
    renderWithProvider(
      <CaptionEditor
        draftId="draft_test1"
        initialCaption=""
      />,
    );
    expect(screen.getByRole('region', { name: /Légende et accroche/i })).toBeInTheDocument();
  });

  it('shows session expired link when autosave status is session_expired', () => {
    render(
      <AutosaveIndicator
        status="session_expired"
        isDirty={false}
        lastSavedAt={null}
        error="session_expired"
      />,
    );
    const link = screen.getByRole('alert');
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/admin/login');
    expect(link).toHaveTextContent(/Session expirée — se reconnecter/);
  });

  it('does not show session expired link on normal error', () => {
    render(
      <AutosaveIndicator
        status="error"
        isDirty={false}
        lastSavedAt={null}
        error="Some error"
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert.tagName).toBe('SPAN');
    expect(alert).toHaveTextContent(/Échec — réessayer/);
  });
});

describe('CaptionEditor — instance autosave partagée (P2, audit 2026-06-10 §02)', () => {
  it('route les frappes vers l’instance fournie par le workspace (pas une instance interne)', () => {
    const shared = {
      status: 'idle' as const,
      lastSavedAt: null,
      isDirty: false,
      patch: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      error: null,
    };
    renderWithProvider(
      <CaptionEditor
        draftId="draft_test1"
        initialCaption="Initiale"
        initialHook={null}
        autosave={shared}
      />,
    );
    const caption = screen.getByLabelText(/Légende complète/i);
    fireEvent.change(caption, { target: { value: 'Nouvelle caption' } });
    expect(shared.patch).toHaveBeenCalledWith({ caption: 'Nouvelle caption' });

    const hook = screen.getByLabelText(/Accroche du draft/i);
    fireEvent.change(hook, { target: { value: 'Hook !' } });
    expect(shared.patch).toHaveBeenCalledWith({ hook: 'Hook !' });
  });
});
