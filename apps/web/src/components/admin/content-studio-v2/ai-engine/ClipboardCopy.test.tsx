/**
 * @vitest-environment jsdom
 */
/**
 * Tests for the CopyButton / clipboard copy functionality inside
 * GenerationResult.
 *
 * Gap #4 — 6 tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  GenerationResult,
  type GenerationResultData,
} from './GenerationResult';

// Mock next/link
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

function buildResult(overrides?: Partial<GenerationResultData>): GenerationResultData {
  return {
    script: {
      hook: 'Amazing hook text for skincare',
      scenes: [],
      cta: 'Buy now',
    },
    caption: 'This is the caption to copy.',
    hashtags: ['glow'],
    ...overrides,
  };
}

describe('ClipboardCopy (via GenerationResult, Gap #4)', () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('"Copier" button exists next to caption', () => {
    render(<GenerationResult result={buildResult()} />);
    // The CopyButton renders with title="Copier" and text "Copier"
    const copyBtn = screen.getByTitle('Copier');
    expect(copyBtn).toBeInTheDocument();
    expect(copyBtn).toHaveTextContent('Copier');
  });

  it('clicking copy calls navigator.clipboard.writeText with caption text', async () => {
    render(<GenerationResult result={buildResult()} />);
    const copyBtn = screen.getByTitle('Copier');
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        'This is the caption to copy.',
      );
    });
  });

  it('copy button shows success feedback after click', async () => {
    render(<GenerationResult result={buildResult()} />);
    const copyBtn = screen.getByTitle('Copier');
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(screen.getByText('Copié')).toBeInTheDocument();
    });
  });

  it('copy works for different caption text', async () => {
    const result = buildResult({ caption: 'Contenu beauté japonaise 2026' });
    render(<GenerationResult result={result} />);
    const copyBtn = screen.getByTitle('Copier');
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        'Contenu beauté japonaise 2026',
      );
    });
  });

  it('copy handles empty caption gracefully (no CopyButton rendered)', () => {
    const result = buildResult({ caption: undefined });
    render(<GenerationResult result={result} />);
    // With no caption, the caption section + CopyButton should not render
    expect(screen.queryByTitle('Copier')).not.toBeInTheDocument();
  });

  it('multiple copies work (second click also calls writeText)', async () => {
    render(<GenerationResult result={buildResult()} />);
    const copyBtn = screen.getByTitle('Copier');

    // First click
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });

    // Second click
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(2);
    });
  });
});
