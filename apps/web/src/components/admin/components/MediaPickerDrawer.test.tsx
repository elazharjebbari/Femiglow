/**
 * RTL — MediaPickerDrawer.
 *
 * Couvre :
 *  - rend le titre du slot et l'input de recherche
 *  - charge les médias via fetch et affiche les vignettes
 *  - filtre côté client par `acceptKinds` (drop les vidéos si image-only)
 *  - bouton média → onPick(id)
 *  - Escape → onClose
 *  - axe sans violation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';
import { MediaPickerDrawer } from './MediaPickerDrawer';
import type { Media } from '@/lib/db/types';

function makeMedia(partial: Partial<Media> = {}): Media {
  return {
    id: 'med_1',
    kind: 'image',
    source: 'upload',
    slug: 'visuel-hero',
    originalUrl: null,
    originalFilename: 'h.png',
    originalSizeBytes: 1024,
    originalMime: 'image/png',
    originalWidth: 1920,
    originalHeight: 1080,
    originalDurationMs: null,
    phash: null,
    blurhash: null,
    palette: [],
    alt: 'Hero',
    caption: null,
    credit: null,
    status: 'ready',
    failureReason: null,
    qualityProfile: 'hero',
    loadingStrategy: 'eager',
    isHero: true,
    overrides: {},
    createdBy: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    deletedAt: null,
    ...partial,
  };
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        rows: [
          makeMedia({ id: 'med_1', slug: 'visuel-hero', kind: 'image' }),
          makeMedia({ id: 'med_2', slug: 'video-demo', kind: 'video' }),
        ],
        total: 2,
        nextCursor: null,
      }),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MediaPickerDrawer', () => {
  it('affiche le titre du slot et le champ de recherche', async () => {
    render(
      <MediaPickerDrawer
        slotKey="primary"
        slotLabel="Visuel principal"
        onClose={() => {}}
        onPick={() => {}}
      />,
    );
    expect(
      screen.getByRole('heading', { name: /assigner un média à « visuel principal »/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('charge les médias et affiche les vignettes', async () => {
    render(
      <MediaPickerDrawer
        slotKey="primary"
        slotLabel="Visuel"
        onClose={() => {}}
        onPick={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('visuel-hero')).toBeInTheDocument();
    });
    expect(screen.getByText('video-demo')).toBeInTheDocument();
  });

  it('filtre par acceptKinds: image only → drop les vidéos', async () => {
    render(
      <MediaPickerDrawer
        slotKey="primary"
        slotLabel="Visuel"
        acceptKinds={['image']}
        onClose={() => {}}
        onPick={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('visuel-hero')).toBeInTheDocument();
    });
    expect(screen.queryByText('video-demo')).toBeNull();
  });

  it('clic sur un média → onPick(id)', async () => {
    const onPick = vi.fn();
    render(
      <MediaPickerDrawer
        slotKey="primary"
        slotLabel="Visuel"
        onClose={() => {}}
        onPick={onPick}
      />,
    );
    await waitFor(() => screen.getByText('visuel-hero'));
    fireEvent.click(screen.getByRole('button', { name: /choisir visuel-hero/i }));
    expect(onPick).toHaveBeenCalledWith('med_1');
  });

  it('Escape → onClose', async () => {
    const onClose = vi.fn();
    render(
      <MediaPickerDrawer
        slotKey="primary"
        slotLabel="Visuel"
        onClose={onClose}
        onPick={() => {}}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('respecte axe', async () => {
    const { container } = render(
      <MediaPickerDrawer
        slotKey="primary"
        slotLabel="Visuel"
        onClose={() => {}}
        onPick={() => {}}
      />,
    );
    await waitFor(() => screen.getByText('visuel-hero'));
    await expectNoAxeViolations(container);
  });
});
