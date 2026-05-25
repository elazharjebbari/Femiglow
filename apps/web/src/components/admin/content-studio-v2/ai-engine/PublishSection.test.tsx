/**
 * @vitest-environment jsdom
 */
/**
 * Tests for the PublishSection — the publish/schedule UI inside GenerationResult.
 *
 * Gap #32 — 10 tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  GenerationResult,
  type GenerationResultData,
  type BridgeResultData,
} from './GenerationResult';

// Mock next/link to render a plain anchor
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const BASE_RESULT: GenerationResultData = {
  script: { hook: 'Hook text', scenes: [], cta: 'CTA text' },
  caption: 'Test caption for publish',
  hashtags: ['test'],
};

const BRIDGE: BridgeResultData = {
  ideaId: 'idea_pub_1',
  briefId: 'brief_pub_1',
  draftId: 'draft_pub_1',
};

describe('PublishSection (via GenerationResult, Gap #32)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('publish section visible when bridgeResult provided', () => {
    render(
      <GenerationResult result={BASE_RESULT} bridgeResult={BRIDGE} />,
    );
    // The PublishSection renders an h4 heading "Publier"
    const heading = screen.getAllByText('Publier').find(
      (el) => el.tagName === 'H4',
    );
    expect(heading).toBeInTheDocument();
  });

  it('publish section hidden when no bridgeResult', () => {
    render(<GenerationResult result={BASE_RESULT} />);
    // "Publier" as a heading should not be present (only the "Publier" button text
    // from the mode selector would be absent too)
    const publishHeadings = screen
      .queryAllByText('Publier')
      .filter(
        (el) => el.tagName === 'H4' || el.classList.contains('cs-display'),
      );
    expect(publishHeadings.length).toBe(0);
  });

  it('"Publier maintenant" mode button exists', () => {
    render(
      <GenerationResult result={BASE_RESULT} bridgeResult={BRIDGE} />,
    );
    expect(
      screen.getByRole('button', { name: /Publier maintenant/i }),
    ).toBeInTheDocument();
  });

  it('"Planifier" mode button exists', () => {
    render(
      <GenerationResult result={BASE_RESULT} bridgeResult={BRIDGE} />,
    );
    expect(
      screen.getByRole('button', { name: /Planifier$/i }),
    ).toBeInTheDocument();
  });

  it('clicking "Planifier" shows datetime input', async () => {
    render(
      <GenerationResult result={BASE_RESULT} bridgeResult={BRIDGE} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Planifier$/i }));
    await waitFor(() => {
      const input = document.querySelector('input[type="datetime-local"]');
      expect(input).toBeInTheDocument();
    });
  });

  it('datetime input accepts future date', async () => {
    render(
      <GenerationResult result={BASE_RESULT} bridgeResult={BRIDGE} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Planifier$/i }));

    const input = document.querySelector(
      'input[type="datetime-local"]',
    ) as HTMLInputElement;
    const futureDate = '2026-12-25T10:00';
    fireEvent.change(input, { target: { value: futureDate } });
    expect(input.value).toBe(futureDate);
  });

  it('"Publier" button calls POST /api/admin/ai-engine/publish', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    render(
      <GenerationResult result={BASE_RESULT} bridgeResult={BRIDGE} />,
    );

    // The publish action button text is "Publier" (in "now" mode)
    const publishBtn = screen.getByRole('button', { name: /^Publier$/ });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/ai-engine/publish',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    // Verify the body includes draftId and mode
    const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(callBody.draftId).toBe('draft_pub_1');
    expect(callBody.mode).toBe('now');
  });

  it('success state shows confirmation message', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    render(
      <GenerationResult result={BASE_RESULT} bridgeResult={BRIDGE} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Publier$/ }));

    await waitFor(() => {
      expect(
        screen.getByText(/publié avec succès/i),
      ).toBeInTheDocument();
    });
  });

  it('error state shows error message', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      json: () =>
        Promise.resolve({ error: 'Publication impossible serveur hors ligne' }),
    });

    render(
      <GenerationResult result={BASE_RESULT} bridgeResult={BRIDGE} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Publier$/ }));

    await waitFor(() => {
      expect(
        screen.getByText(/Publication impossible serveur hors ligne/i),
      ).toBeInTheDocument();
    });
  });

  it('loading state during publish shows spinner', async () => {
    // Never-resolving promise to keep it in publishing state
    fetchSpy.mockReturnValue(new Promise(() => {}));

    render(
      <GenerationResult result={BASE_RESULT} bridgeResult={BRIDGE} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Publier$/ }));

    await waitFor(() => {
      // The Button with loading=true renders a spinner element with cs-spinner class
      const spinner = document.querySelector('.cs-spinner');
      expect(spinner).toBeInTheDocument();
    });
  });
});
