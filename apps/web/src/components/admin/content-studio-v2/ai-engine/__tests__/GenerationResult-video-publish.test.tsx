/**
 * @vitest-environment jsdom
 *
 * Tests for P4 (video player display) and P5 (mock publish badge)
 * in the GenerationResult component.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/* ================================================================
   Mocks
   ================================================================ */

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

vi.mock('lucide-react', () => {
  const R = require('react');
  const icon = (name: string) => (props: Record<string, unknown>) =>
    R.createElement('span', { 'data-testid': `icon-${name}`, ...props }, name);
  return {
    ChevronDown: icon('ChevronDown'),
    ChevronRight: icon('ChevronRight'),
    Copy: icon('Copy'),
    Check: icon('Check'),
    RefreshCw: icon('RefreshCw'),
    ArrowRight: icon('ArrowRight'),
    Sparkles: icon('Sparkles'),
    Image: icon('Image'),
    Film: icon('Film'),
    BookOpen: icon('BookOpen'),
    Send: icon('Send'),
    Calendar: icon('Calendar'),
    CheckCircle: icon('CheckCircle'),
    AlertTriangle: icon('AlertTriangle'),
  };
});

/* ================================================================
   Import the component and types under test
   ================================================================ */

import { GenerationResult } from '../GenerationResult';
import type { GenerationResultData, BridgeResultData } from '../GenerationResult';

/* ================================================================
   Fixtures
   ================================================================ */

const resultWithVideos: GenerationResultData = {
  script: { hook: 'Test hook', scenes: [{ type: 'intro', text: 'Scene 1' }], cta: 'Buy now' },
  caption: 'Test caption',
  hashtags: ['femiglow', 'beauty'],
  images: ['https://example.com/img1.jpg'],
  videos: ['https://example.com/video1.mp4', 'https://example.com/video2.mp4'],
  qualityScores: { text_quality: 0.9, visual_quality: 0.8 },
  totalCostCents: 150,
};

const resultNoVideos: GenerationResultData = {
  caption: 'Just text',
  hashtags: ['test'],
};

const mockBridgeResult: BridgeResultData = {
  ideaId: 'mock-idea-123',
  briefId: 'mock-brief-123',
  draftId: 'mock-draft-123',
};

const realBridgeResult: BridgeResultData = {
  ideaId: 'ci_abc123',
  briefId: 'cb_abc123',
  draftId: 'cd_abc123',
};

/* ================================================================
   Helpers
   ================================================================ */

/**
 * Find the primary publish action button (the cs-btn variant inside PublishSection).
 * Its text content is "Send" (from mocked icon) + "Publier" when mode is 'now'.
 */
function getPublishActionButton(): HTMLElement {
  const csBtns = screen.getAllByRole('button').filter(
    (btn) => btn.classList.contains('cs-btn') && /Publier/.test(btn.textContent ?? ''),
  );
  // Filter out "Régénérer", "Utiliser ce contenu", etc.
  // The publish action button says "Publier" or "Planifier la publication" — not "maintenant"
  const publishBtn = csBtns.find(
    (btn) => !/Utiliser|R[eé]g[eé]n[eé]rer/.test(btn.textContent ?? ''),
  );
  if (!publishBtn) throw new Error('Could not find publish action button');
  return publishBtn;
}

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

/* ================================================================
   P4 — Video display
   ================================================================ */

describe('P4 — Video display', () => {
  it('renders video section with title "Videos (2)"', () => {
    render(<GenerationResult result={resultWithVideos} />);
    expect(screen.getByText('Vidéos (2)')).toBeInTheDocument();
  });

  it('renders two <video> elements', () => {
    const { container } = render(<GenerationResult result={resultWithVideos} />);
    // The CollapsibleSection is defaultOpen, so videos are visible
    // Click the button to expand if not already open
    const videosButton = screen.getByText('Vidéos (2)');
    // defaultOpen is true, so content should be visible; click to ensure open state
    const videoElements = container.querySelectorAll('video');
    expect(videoElements).toHaveLength(2);
  });

  it('video elements have controls attribute', () => {
    const { container } = render(<GenerationResult result={resultWithVideos} />);
    const videoElements = container.querySelectorAll('video');
    videoElements.forEach((video) => {
      expect(video).toHaveAttribute('controls');
    });
  });

  it('video elements have correct src attributes', () => {
    const { container } = render(<GenerationResult result={resultWithVideos} />);
    const videoElements = container.querySelectorAll('video');
    expect(videoElements[0]).toHaveAttribute('src', 'https://example.com/video1.mp4');
    expect(videoElements[1]).toHaveAttribute('src', 'https://example.com/video2.mp4');
  });

  it('videos section is a CollapsibleSection with a clickable button', () => {
    render(<GenerationResult result={resultWithVideos} />);
    const titleButton = screen.getByText('Vidéos (2)').closest('button');
    expect(titleButton).toBeInTheDocument();
    expect(titleButton!.tagName).toBe('BUTTON');
  });

  it('does not render video section when result has no videos property', () => {
    render(<GenerationResult result={resultNoVideos} />);
    expect(screen.queryByText(/Vid[eé]os/)).not.toBeInTheDocument();
  });

  it('does not render video section when videos array is empty', () => {
    const resultEmptyVideos: GenerationResultData = {
      caption: 'Text only',
      hashtags: ['test'],
      videos: [],
    };
    render(<GenerationResult result={resultEmptyVideos} />);
    expect(screen.queryByText(/Vid[eé]os/)).not.toBeInTheDocument();
  });
});

/* ================================================================
   P5 — PublishSection mock badge
   ================================================================ */

describe('P5 — PublishSection mock badge', () => {
  it('renders PublishSection when bridgeResult is provided', () => {
    render(<GenerationResult result={resultNoVideos} bridgeResult={mockBridgeResult} />);
    const headings = screen.getAllByText('Publier');
    const h4 = headings.find((el) => el.tagName === 'H4');
    expect(h4).toBeDefined();
  });

  it('"Publier" heading is visible', () => {
    render(<GenerationResult result={resultNoVideos} bridgeResult={mockBridgeResult} />);
    const headings = screen.getAllByText('Publier');
    const h4 = headings.find((el) => el.tagName === 'H4');
    expect(h4).toBeDefined();
    expect(h4!.tagName).toBe('H4');
  });

  it('"Mode Mock" badge is visible when draftId starts with "mock-"', () => {
    render(<GenerationResult result={resultNoVideos} bridgeResult={mockBridgeResult} />);
    expect(screen.getByText('Mode Mock')).toBeInTheDocument();
  });

  it('"Mode Mock" badge is visible when draftId contains "test"', () => {
    const testBridge: BridgeResultData = {
      ideaId: 'idea-1',
      briefId: 'brief-1',
      draftId: 'draft-test-456',
    };
    render(<GenerationResult result={resultNoVideos} bridgeResult={testBridge} />);
    expect(screen.getByText('Mode Mock')).toBeInTheDocument();
  });

  it('"Mode Mock" badge is NOT visible when draftId is a real UUID like "cd_abc123"', () => {
    render(<GenerationResult result={resultNoVideos} bridgeResult={realBridgeResult} />);
    expect(screen.queryByText('Mode Mock')).not.toBeInTheDocument();
  });

  it('"Publier maintenant" button exists', () => {
    render(<GenerationResult result={resultNoVideos} bridgeResult={mockBridgeResult} />);
    expect(screen.getByText('Publier maintenant')).toBeInTheDocument();
  });

  it('"Planifier" button exists', () => {
    render(<GenerationResult result={resultNoVideos} bridgeResult={mockBridgeResult} />);
    expect(screen.getByText('Planifier')).toBeInTheDocument();
  });

  it('clicking "Planifier" shows datetime-local input', () => {
    render(<GenerationResult result={resultNoVideos} bridgeResult={mockBridgeResult} />);
    const planifierButton = screen.getByText('Planifier');
    fireEvent.click(planifierButton);
    const dateInput = screen.getByDisplayValue('');
    expect(dateInput).toHaveAttribute('type', 'datetime-local');
  });

  it('clicking "Publier maintenant" calls fetch with correct endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, postId: 'post-001' }),
    });
    globalThis.fetch = fetchSpy;

    render(<GenerationResult result={resultNoVideos} bridgeResult={mockBridgeResult} />);

    const publishActionButton = getPublishActionButton();
    fireEvent.click(publishActionButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/ai-engine/publish',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('after successful publish, success message is shown', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, postId: 'post-001' }),
    });
    globalThis.fetch = fetchSpy;

    render(<GenerationResult result={resultNoVideos} bridgeResult={mockBridgeResult} />);

    const publishActionButton = getPublishActionButton();
    fireEvent.click(publishActionButton);

    await waitFor(() => {
      expect(screen.getByText(/publi[eé] avec succ[eè]s/i)).toBeInTheDocument();
    });
  });

  it('does not render PublishSection when bridgeResult is not provided', () => {
    render(<GenerationResult result={resultNoVideos} />);
    // The "Publier" heading from PublishSection should not be present.
    // Note: there is a "Publier" text inside the action button for publish mode,
    // but the h4 heading only exists inside PublishSection.
    const headings = screen.queryAllByText('Publier');
    const h4Headings = headings.filter((el) => el.tagName === 'H4');
    expect(h4Headings).toHaveLength(0);
  });

  it('with real draftId, "Mode Mock" badge is NOT present', () => {
    render(<GenerationResult result={resultNoVideos} bridgeResult={realBridgeResult} />);
    expect(screen.queryByText('Mode Mock')).not.toBeInTheDocument();
  });

  it('fetch body includes draftId and mode when publishing', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    globalThis.fetch = fetchSpy;

    render(<GenerationResult result={resultNoVideos} bridgeResult={mockBridgeResult} />);

    const publishActionButton = getPublishActionButton();
    fireEvent.click(publishActionButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, options] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(options.body);
      expect(body.draftId).toBe('mock-draft-123');
      expect(body.mode).toBe('now');
    });
  });
});
