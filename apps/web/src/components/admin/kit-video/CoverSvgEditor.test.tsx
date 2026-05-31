/**
 * Tests `CoverSvgEditor` — 3 onglets + aperçu live + API calls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { CoverSvgEditor } from './CoverSvgEditor';
import type { KitVideoPosterCoverSvg } from '@/lib/kit/video/types';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as any).fetch = fetchMock;
});

afterEach(() => {
  cleanup();
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const VALID_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="#E8EDE3"/></svg>';

describe('CoverSvgEditor — onglets', () => {
  it('rend 3 onglets (Code SVG / Fichier SVG / URL externe)', () => {
    render(<CoverSvgEditor value={null} onChange={() => {}} />);
    expect(screen.getByTestId('cover-svg-tab-inline')).toBeDefined();
    expect(screen.getByTestId('cover-svg-tab-file')).toBeDefined();
    expect(screen.getByTestId('cover-svg-tab-url')).toBeDefined();
  });

  it('onglet inline actif par défaut', () => {
    render(<CoverSvgEditor value={null} onChange={() => {}} />);
    expect(
      screen.getByTestId('cover-svg-tab-inline').getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('switch onglet : clic sur url active l\'input URL', () => {
    render(<CoverSvgEditor value={null} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId('cover-svg-tab-url'));
    expect(screen.getByTestId('cover-svg-url-input')).toBeDefined();
  });
});

describe('CoverSvgEditor — mode inline', () => {
  it('édition textarea émet onChange avec source=inline', () => {
    const onChange = vi.fn();
    render(<CoverSvgEditor value={null} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('cover-svg-inline-input'), {
      target: { value: VALID_SVG },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'inline', inline: VALID_SVG }),
    );
  });

  it('aperçu live rendu pour SVG inline (sanitized)', () => {
    render(<CoverSvgEditor value={null} onChange={() => {}} />);
    fireEvent.change(screen.getByTestId('cover-svg-inline-input'), {
      target: { value: VALID_SVG },
    });
    const preview = screen.getByTestId('cover-svg-preview');
    expect(preview.innerHTML).toContain('rect');
  });

  it('badge taille passe au vert pour SVG ≤ 50 kB', () => {
    render(<CoverSvgEditor value={null} onChange={() => {}} />);
    fireEvent.change(screen.getByTestId('cover-svg-inline-input'), {
      target: { value: VALID_SVG },
    });
    const badge = screen.getByTestId('cover-svg-inline-size');
    expect(badge.textContent).toMatch(/✓/);
  });

  it('badge taille passe au rouge pour SVG > 50 kB', () => {
    render(<CoverSvgEditor value={null} onChange={() => {}} />);
    const huge = 'x'.repeat(50_001);
    fireEvent.change(screen.getByTestId('cover-svg-inline-input'), {
      target: { value: huge },
    });
    const badge = screen.getByTestId('cover-svg-inline-size');
    expect(badge.textContent).toMatch(/✗/);
  });

  it('strip <script> dans l\'aperçu live (sanitize client)', () => {
    render(<CoverSvgEditor value={null} onChange={() => {}} />);
    const dangerous =
      '<svg viewBox="0 0 100 100"><script>alert(1)</script><rect width="100" height="100"/></svg>';
    fireEvent.change(screen.getByTestId('cover-svg-inline-input'), {
      target: { value: dangerous },
    });
    const preview = screen.getByTestId('cover-svg-preview');
    expect(preview.innerHTML).not.toContain('<script');
  });
});

describe('CoverSvgEditor — mode file', () => {
  it('upload appelle POST /api/admin/kit/video/cover/upload et émet onChange', async () => {
    const onChange = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ fileMediaId: 'kvc_xyz789', size: 1234, warnings: [] }, 201),
    );
    render(<CoverSvgEditor value={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('cover-svg-tab-file'));

    const file = new File([VALID_SVG], 'cover.svg', { type: 'image/svg+xml' });
    const input = screen.getByTestId('cover-svg-file-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/admin/kit/video/cover/upload');
    await waitFor(() =>
      expect(screen.getByTestId('cover-svg-file-ok').textContent).toMatch(/kvc_/),
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'file', fileMediaId: 'kvc_xyz789' }),
    );
  });

  it('erreur upload affiche le message serveur', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: 'SVG invalide' } }, 422),
    );
    render(<CoverSvgEditor value={null} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId('cover-svg-tab-file'));

    const file = new File(['bad'], 'bad.svg', { type: 'image/svg+xml' });
    const input = screen.getByTestId('cover-svg-file-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() =>
      expect(screen.getByTestId('cover-svg-file-error').textContent).toMatch(/invalide/i),
    );
  });
});

describe('CoverSvgEditor — mode url', () => {
  it('clic Tester appelle POST /api/admin/kit/video/cover/test-url', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: true, contentType: 'image/svg+xml', size: 4321 }),
    );
    render(<CoverSvgEditor value={null} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId('cover-svg-tab-url'));

    fireEvent.change(screen.getByTestId('cover-svg-url-input'), {
      target: { value: 'https://cdn.example.com/cover.svg' },
    });
    fireEvent.click(screen.getByTestId('cover-svg-url-test'));

    await waitFor(() =>
      expect(screen.getByTestId('cover-svg-url-ok').textContent).toMatch(/image\/svg\+xml/),
    );
  });

  it('Tester affiche l\'erreur si URL invalide', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: false, reason: 'Seules les URLs HTTPS sont acceptées.' }),
    );
    render(<CoverSvgEditor value={null} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId('cover-svg-tab-url'));

    fireEvent.change(screen.getByTestId('cover-svg-url-input'), {
      target: { value: 'http://insecure.com/a.svg' },
    });
    fireEvent.click(screen.getByTestId('cover-svg-url-test'));

    await waitFor(() =>
      expect(screen.getByTestId('cover-svg-url-error').textContent).toMatch(/HTTPS/i),
    );
  });

  it('blur input URL émet onChange avec source=url', () => {
    const onChange = vi.fn();
    render(<CoverSvgEditor value={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('cover-svg-tab-url'));

    const input = screen.getByTestId('cover-svg-url-input');
    fireEvent.change(input, { target: { value: 'https://cdn.example.com/cover.svg' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'url', url: 'https://cdn.example.com/cover.svg' }),
    );
  });
});

describe('CoverSvgEditor — bouton Effacer', () => {
  it('apparaît quand value est non-null et émet null au clic', () => {
    const onChange = vi.fn();
    const value: KitVideoPosterCoverSvg = { source: 'inline', inline: VALID_SVG };
    render(<CoverSvgEditor value={value} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('cover-svg-clear'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('absent quand value est null', () => {
    render(<CoverSvgEditor value={null} onChange={() => {}} />);
    expect(screen.queryByTestId('cover-svg-clear')).toBeNull();
  });
});

describe('CoverSvgEditor — aria-label', () => {
  it('édition aria-label propage dans onChange.meta.ariaLabel', () => {
    const onChange = vi.fn();
    const value: KitVideoPosterCoverSvg = { source: 'inline', inline: VALID_SVG };
    render(<CoverSvgEditor value={value} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('cover-svg-aria-input'), {
      target: { value: 'Rituel ongles' },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'inline',
        meta: { ariaLabel: 'Rituel ongles' },
      }),
    );
  });
});
