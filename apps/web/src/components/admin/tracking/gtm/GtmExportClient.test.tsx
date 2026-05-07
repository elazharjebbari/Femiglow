/**
 * Tests d'intégration de la page client `/admin/tracking/gtm`.
 *
 * MSW (msw/node) ne capture pas les paths relatifs en jsdom sans
 * baseURL absolue. On mocke donc `window.fetch` directement avec
 * `vi.fn()`. Les fixtures de payload viennent de `gtm-handlers.ts`.
 *
 * Pour le clipboard : userEvent.setup() v14 monte sa propre fake
 * clipboard ; on espionne via `vi.spyOn(navigator.clipboard, ...)`
 * APRÈS le setup pour pouvoir intercepter les appels.
 */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makePayload } from '@/test/msw/gtm-handlers';
import { GtmExportClient } from './GtmExportClient';

const initial = makePayload('production');

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  // Force prefers-reduced-motion → count-up désactivé (les chiffres
  // s'affichent immédiatement, on peut assert avec getByText sans
  // attendre la fin de l'animation).
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (q: string) => ({
      matches: q.includes('prefers-reduced-motion'),
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockOk(body: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body,
  } as Response);
}

function mockErr(status = 500) {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error: { message: 'oops' } }),
  } as Response);
}

function spyClipboardWrite() {
  return vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
}

describe('GtmExportClient — état initial', () => {
  it('affiche le badge production', () => {
    render(<GtmExportClient initial={initial} />);
    const badges = screen.getAllByText(/production/i);
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('rend les 4 cartes de stats', () => {
    render(<GtmExportClient initial={initial} />);
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('Triggers')).toBeInTheDocument();
    expect(screen.getByText('Variables')).toBeInTheDocument();
    expect(screen.getByText('Folders')).toBeInTheDocument();
  });

  it('rend le bouton Télécharger avec icône et raccourci ⌘S', () => {
    render(<GtmExportClient initial={initial} />);
    const btn = screen.getByRole('button', { name: /télécharger/i });
    expect(btn).toBeInTheDocument();
    expect(btn.querySelector('svg')).not.toBeNull();
    expect(btn.querySelector('kbd')?.textContent).toMatch(/⌘S/);
  });

  it('rend le tablist avec 4 environnements', () => {
    render(<GtmExportClient initial={initial} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });
});

describe('GtmExportClient — switch environnement', () => {
  it('charge les stats du nouvel env via API', async () => {
    const user = userEvent.setup();
    const previewPayload = makePayload('preview');
    mockOk({
      ...previewPayload,
      stats: { ...previewPayload.stats, tags: 62 },
    });
    render(<GtmExportClient initial={initial} />);

    await user.click(screen.getByRole('tab', { name: /preview/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('env=preview'),
        expect.objectContaining({ credentials: 'include' }),
      );
    });
    await waitFor(
      () => {
        expect(screen.getByText('62')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("affiche un message d'erreur si l'API retourne 5xx", async () => {
    const user = userEvent.setup();
    mockErr(500);
    render(<GtmExportClient initial={initial} />);

    await user.click(screen.getByRole('tab', { name: /stage/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/échec du chargement/i)).toBeInTheDocument();
    });
  });

  it('le bouton "Réessayer" relance le fetch', async () => {
    const user = userEvent.setup();
    mockErr(500);
    render(<GtmExportClient initial={initial} />);

    await user.click(screen.getByRole('tab', { name: /stage/i }));
    await waitFor(() => screen.getByRole('alert'));

    mockOk(makePayload('stage'));
    await user.click(screen.getByRole('button', { name: /réessayer/i }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});

describe('GtmExportClient — copie JSON', () => {
  it('copie le pretty JSON dans le presse-papier et affiche "Copié"', async () => {
    const user = userEvent.setup();
    const writeText = spyClipboardWrite();
    render(<GtmExportClient initial={initial} />);

    await user.click(screen.getByRole('button', { name: /copier le json/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(initial.pretty);
    });
    await waitFor(() => {
      expect(screen.getByText(/^Copié$/i)).toBeInTheDocument();
    });
  });

  it('affiche une erreur si la copie échoue', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(
      new Error('blocked'),
    );
    render(<GtmExportClient initial={initial} />);

    await user.click(screen.getByRole('button', { name: /copier le json/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});

describe('GtmExportClient — plein écran', () => {
  it('ouvre la modale plein écran au clic et la ferme avec Esc', async () => {
    const user = userEvent.setup();
    render(<GtmExportClient initial={initial} />);

    await user.click(screen.getByRole('button', { name: /plein écran/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

describe('GtmExportClient — raccourcis clavier', () => {
  it('Cmd+Shift+C copie le JSON', async () => {
    const user = userEvent.setup();
    const writeText = spyClipboardWrite();
    render(<GtmExportClient initial={initial} />);

    await user.keyboard('{Meta>}{Shift>}C{/Shift}{/Meta}');
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(initial.pretty);
    });
  });
});
