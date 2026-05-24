/**
 * Tests for PublishActionGroup — publish dropdown + autosave indicator.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublishActionGroup } from './PublishActionGroup';
import type { AutosaveStatus } from '@/lib/content-studio-v2/state/StudioContext';

function makeAutosave(overrides: Partial<{
  status: AutosaveStatus;
  isDirty: boolean;
  lastSavedAt: number | null;
  error: string | null;
  flush: () => Promise<void>;
}> = {}) {
  return {
    status: 'idle' as AutosaveStatus,
    isDirty: false,
    lastSavedAt: null,
    error: null,
    flush: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('PublishActionGroup', () => {
  it('Publier button is disabled when postId is null', () => {
    render(
      <PublishActionGroup postId={null} autosave={makeAutosave()} />,
    );
    const publishBtn = screen.getByRole('button', { name: /Options de publication/i });
    expect(publishBtn).toBeDisabled();
  });

  it('Publier button is enabled when postId is provided', () => {
    render(
      <PublishActionGroup postId="post_test1" autosave={makeAutosave()} />,
    );
    const publishBtn = screen.getByRole('button', { name: /Options de publication/i });
    expect(publishBtn).not.toBeDisabled();
  });

  it('shows message when postId is null', () => {
    render(
      <PublishActionGroup postId={null} autosave={makeAutosave()} />,
    );
    expect(
      screen.getByText(/Approuvez le draft pour activer la publication/i),
    ).toBeInTheDocument();
  });

  it('shows autosave saving indicator', () => {
    render(
      <PublishActionGroup
        postId="post_test1"
        autosave={makeAutosave({ status: 'saving' })}
      />,
    );
    expect(screen.getByText(/Enregistrement/i)).toBeInTheDocument();
  });

  it('shows autosave error indicator', () => {
    render(
      <PublishActionGroup
        postId="post_test1"
        autosave={makeAutosave({ status: 'error', error: 'Network failed' })}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Échec/i)).toBeInTheDocument();
  });

  it('shows autosave saved indicator', () => {
    render(
      <PublishActionGroup
        postId="post_test1"
        autosave={makeAutosave({ status: 'saved', lastSavedAt: Date.now() })}
      />,
    );
    expect(screen.getByText(/Enregistré/i)).toBeInTheDocument();
  });

  it('disabled prop also disables the publish button', () => {
    render(
      <PublishActionGroup
        postId="post_test1"
        autosave={makeAutosave()}
        disabled
      />,
    );
    const publishBtn = screen.getByRole('button', { name: /Options de publication/i });
    expect(publishBtn).toBeDisabled();
  });

  it('renders the footer with aria-label "Publier"', () => {
    render(
      <PublishActionGroup postId={null} autosave={makeAutosave()} />,
    );
    expect(
      screen.getByRole('contentinfo', { name: /Publier/i }),
    ).toBeInTheDocument();
  });
});
