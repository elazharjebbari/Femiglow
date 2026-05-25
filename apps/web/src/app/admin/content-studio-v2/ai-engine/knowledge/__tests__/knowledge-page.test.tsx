/**
 * Tests for the AI Engine Knowledge Base page — displays collections, documents,
 * stats cards, ingest/embed forms, and banner notifications.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock next/link
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    style: _style,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    style?: React.CSSProperties;
    [k: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import KnowledgeBasePage from '../page';

function buildCollection(overrides?: Record<string, unknown>) {
  return {
    id: 'col_1',
    name: 'Science cosmétique',
    slug: 'science-cosmetique',
    description: 'Documents scientifiques sur les ingrédients',
    category: 'science',
    documentCount: 12,
    chunkCount: 156,
    lastIndexedAt: '2026-05-20T10:00:00Z',
    isActive: true,
    ...overrides,
  };
}

function buildDocument(overrides?: Record<string, unknown>) {
  return {
    id: 'doc_1',
    title: 'Guide Niacinamide',
    sourceType: 'text',
    chunkCount: 8,
    createdAt: '2026-05-15T08:00:00Z',
    ...overrides,
  };
}

describe('KnowledgeBasePage', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Base de connaissances" title', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ collections: [buildCollection()] }),
    });

    render(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(screen.getByText('Base de connaissances')).toBeInTheDocument();
    });
  });

  it('shows stats cards (Collections, Documents, Chunks, En attente)', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ collections: [buildCollection()] }),
    });

    render(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(screen.getByText('Collections')).toBeInTheDocument();
    });
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Chunks')).toBeInTheDocument();
    expect(screen.getByText('En attente')).toBeInTheDocument();
  });

  it('renders collection rows', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          collections: [
            buildCollection(),
            buildCollection({
              id: 'col_2',
              name: 'Stratégie marque',
              slug: 'strategie-marque',
              category: 'strategy',
              documentCount: 5,
              chunkCount: 42,
            }),
          ],
        }),
    });

    render(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(screen.getByText('Science cosmétique')).toBeInTheDocument();
    });
    expect(screen.getByText('Stratégie marque')).toBeInTheDocument();
  });

  it('collection shows name, category badge, doc/chunk counts', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ collections: [buildCollection()] }),
    });

    render(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(screen.getByText('Science cosmétique')).toBeInTheDocument();
    });
    expect(screen.getByText('Science')).toBeInTheDocument(); // category badge
    // "12" appears in both stat card and collection row, use getAllByText
    expect(screen.getAllByText(/12/).length).toBeGreaterThanOrEqual(1); // doc count
    expect(screen.getAllByText(/156/).length).toBeGreaterThanOrEqual(1); // chunk count
  });

  it('clicking collection expands to show documents', async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes('/knowledge/science-cosmetique/documents')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ documents: [buildDocument()] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ collections: [buildCollection()] }),
      });
    });

    render(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(screen.getByText('Science cosmétique')).toBeInTheDocument();
    });

    // Click to expand
    fireEvent.click(screen.getByText('Science cosmétique'));

    await waitFor(() => {
      expect(screen.getByText('Guide Niacinamide')).toBeInTheDocument();
    });
  });

  it('"Ajouter un document" form appears', async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes('/documents')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ documents: [buildDocument()] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ collections: [buildCollection()] }),
      });
    });

    render(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(screen.getByText('Science cosmétique')).toBeInTheDocument();
    });

    // Expand the collection
    fireEvent.click(screen.getByText('Science cosmétique'));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Ajouter un document/i }),
      ).toBeInTheDocument();
    });

    // Click "Ajouter un document"
    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter un document/i }),
    );

    // The form should now be visible with title input and content textarea
    await waitFor(() => {
      expect(screen.getByText('Titre du document')).toBeInTheDocument();
    });
  });

  it('title input and content textarea are present', async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes('/documents')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ documents: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ collections: [buildCollection()] }),
      });
    });

    render(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(screen.getByText('Science cosmétique')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Science cosmétique'));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Ajouter un document/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter un document/i }),
    );

    await waitFor(() => {
      expect(screen.getByText('Titre du document')).toBeInTheDocument();
    });
    expect(screen.getByText('Contenu')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Guide des ingrédients/i),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Collez le contenu/i),
    ).toBeInTheDocument();
  });

  it('"Ingérer" button calls POST API', async () => {
    let postCalled = false;

    fetchSpy.mockImplementation((url: string, opts?: RequestInit) => {
      if (
        url.includes('/documents') &&
        opts?.method === 'POST'
      ) {
        postCalled = true;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'doc_new',
              chunkCount: 5,
            }),
        });
      }
      if (url.includes('/documents')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ documents: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ collections: [buildCollection()] }),
      });
    });

    render(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(screen.getByText('Science cosmétique')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Science cosmétique'));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Ajouter un document/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter un document/i }),
    );

    await waitFor(() => {
      expect(screen.getByText('Titre du document')).toBeInTheDocument();
    });

    // Fill in the form
    fireEvent.change(screen.getByPlaceholderText(/Guide des ingrédients/i), {
      target: { value: 'Mon nouveau document' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Collez le contenu/i), {
      target: { value: 'Contenu du document test' },
    });

    // Click Ingérer
    fireEvent.click(screen.getByRole('button', { name: /^Ingérer$/i }));

    await waitFor(() => {
      expect(postCalled).toBe(true);
    });
  });

  it('"Générer les embeddings" button calls POST /embed', async () => {
    let embedCalled = false;

    fetchSpy.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/knowledge/embed') && opts?.method === 'POST') {
        embedCalled = true;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              documentsProcessed: 3,
              chunksCreated: 45,
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ collections: [buildCollection()] }),
      });
    });

    render(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Générer les embeddings/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Générer les embeddings/i }),
    );

    await waitFor(() => {
      expect(embedCalled).toBe(true);
    });
  });

  it('success banner after embedding', async () => {
    fetchSpy.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/knowledge/embed') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              documentsProcessed: 3,
              chunksCreated: 45,
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ collections: [buildCollection()] }),
      });
    });

    render(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Générer les embeddings/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Générer les embeddings/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/3 documents traités/)).toBeInTheDocument();
    });
    expect(screen.getByText(/45/)).toBeInTheDocument();
  });

  it('error banner on embedding failure', async () => {
    fetchSpy.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/knowledge/embed') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Embedding service unavailable' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ collections: [buildCollection()] }),
      });
    });

    render(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Générer les embeddings/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Générer les embeddings/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText('Embedding service unavailable'),
      ).toBeInTheDocument();
    });
  });

  it('empty collection shows "Indexé : Jamais"', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          collections: [
            buildCollection({ lastIndexedAt: null }),
          ],
        }),
    });

    render(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(screen.getByText(/Jamais/)).toBeInTheDocument();
    });
  });
});
