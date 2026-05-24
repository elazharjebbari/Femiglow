/**
 * Tests for MediaStudio — generate visuals, pick/select media.
 *
 * The component uses `useGenerationEstimator` which relies on localStorage.
 * We mock localStorage via the jsdom environment (already available).
 */

import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server, http, HttpResponse } from '@/test/msw/server';
import { MediaStudio } from './MediaStudio';
import type { StudioV2MediaItem } from '@/lib/content-studio-v2/media/types';

// sonner toast spy
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import { toast } from 'sonner';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

const defaultProps = {
  draftId: 'draft_test1',
  items: [] as StudioV2MediaItem[],
  selectedMedia: null,
  onSelect: vi.fn(),
  onUploaded: vi.fn(),
};

describe('MediaStudio', () => {
  it('renders "Générer un visuel IA" button', () => {
    render(<MediaStudio {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: /Générer un visuel/i }),
    ).toBeInTheDocument();
  });

  it('click "Générer" calls fetch to /generate-visual and calls onUploaded on success', async () => {
    const onUploaded = vi.fn();
    const onSelect = vi.fn();
    server.use(
      http.post(
        '/api/admin/content-studio/drafts/draft_test1/generate-visual',
        async () => {
          return HttpResponse.json({
            media: {
              id: 'media_gen1',
              alt: 'Visuel IA test',
              previewUrl: '/preview.webp',
              thumbUrl: '/thumb.webp',
              originalUrl: '/original.png',
            },
          });
        },
      ),
    );
    render(
      <MediaStudio
        {...defaultProps}
        onUploaded={onUploaded}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Générer un visuel/i }));

    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledOnce();
    });
    expect(onUploaded).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'media_gen1', kind: 'image' }),
    );
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'media_gen1' }),
    );
    expect(toast.success).toHaveBeenCalledWith('Visuel IA généré');
  });

  it('shows estimator/progress bar during generation', async () => {
    let resolveResponse: (value: Response) => void;
    const responsePromise = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });

    server.use(
      http.post(
        '/api/admin/content-studio/drafts/draft_test1/generate-visual',
        async () => {
          // Wait for the promise before responding
          return responsePromise as unknown as ReturnType<typeof HttpResponse.json>;
        },
      ),
    );
    render(<MediaStudio {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Générer un visuel/i }));

    // Estimator bar should appear
    await waitFor(() => {
      expect(
        screen.getByRole('status', { name: /Progression de la génération/i }),
      ).toBeInTheDocument();
    });

    // Now resolve the request
    resolveResponse!(
      HttpResponse.json({
        media: {
          id: 'media_gen2',
          alt: 'test',
          previewUrl: '/p.webp',
          thumbUrl: '/t.webp',
          originalUrl: '/o.png',
        },
      }) as unknown as Response,
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('status', { name: /Progression de la génération/i }),
      ).not.toBeInTheDocument();
    });
  });

  it('on error (e.g. 429), shows error toast', async () => {
    server.use(
      http.post(
        '/api/admin/content-studio/drafts/draft_test1/generate-visual',
        async () => {
          return HttpResponse.json(
            { error: { message: 'Rate limit exceeded' } },
            { status: 429 },
          );
        },
      ),
    );
    render(<MediaStudio {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Générer un visuel/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded'),
      );
    });
  });

  it('renders the section with proper aria-label', () => {
    render(<MediaStudio {...defaultProps} />);
    expect(screen.getByRole('region', { name: /Studio média/i })).toBeInTheDocument();
  });
});
