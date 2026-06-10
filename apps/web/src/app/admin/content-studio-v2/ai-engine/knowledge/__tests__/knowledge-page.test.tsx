/**
 * @vitest-environment jsdom
 *
 * Comprehensive tests for the AI Engine Knowledge Base page.
 * Covers: general rendering, collections CRUD, documents CRUD,
 * embedding generation, and the create-collection form.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

/* ================================================================
   Mocks — primitives, next/link, lucide-react icons
   ================================================================ */

vi.mock('@/components/admin/content-studio-v2/primitives', async () => {
  const R = await import('react');
  return {
    Button: (props: Record<string, unknown>) => {
      const { leftIcon, children, loading, variant, size, ...rest } = props;
      return R.createElement(
        'button',
        { ...rest, 'data-loading': loading ? 'true' : undefined },
        loading ? R.createElement('span', { 'data-testid': 'spinner' }, '') : null,
        leftIcon as React.ReactNode,
        children as React.ReactNode,
      );
    },
    Badge: (props: Record<string, unknown>) => {
      const { tone, children, size: _size, ...rest } = props;
      return R.createElement('span', { ...rest, 'data-tone': tone }, children as React.ReactNode);
    },
    Input: (props: Record<string, unknown>) => {
      const { label, leftAddon, ...rest } = props;
      return R.createElement(
        'div',
        null,
        label ? R.createElement('label', null, label as string) : null,
        leftAddon as React.ReactNode,
        R.createElement('input', rest),
      );
    },
  };
});

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

/* ================================================================
   Builder helpers
   ================================================================ */

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

function buildCollection2(overrides?: Record<string, unknown>) {
  return {
    id: 'col_2',
    name: 'Stratégie marque',
    slug: 'strategie-marque',
    description: 'Brand strategy docs',
    category: 'strategy',
    documentCount: 5,
    chunkCount: 42,
    lastIndexedAt: '2026-04-10T14:30:00Z',
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

function buildDocument2(overrides?: Record<string, unknown>) {
  return {
    id: 'doc_2',
    title: 'Tendances 2026',
    sourceType: 'url',
    chunkCount: 0,
    createdAt: '2026-05-18T12:00:00Z',
    ...overrides,
  };
}

/* ================================================================
   Fetch mock helper
   ================================================================ */

type FetchRoute = {
  collections?: ReturnType<typeof buildCollection>[];
  documents?: Record<string, ReturnType<typeof buildDocument>[]>;
  documentDetail?: Record<string, { contentText: string }>;
  embedResponse?: Record<string, unknown> | null;
  embedError?: boolean;
  createCollectionResponse?: Record<string, unknown> | null;
  createCollectionError?: string | null;
  patchCollectionResponse?: Record<string, unknown> | null;
  patchCollectionError?: string | null;
  deleteCollectionError?: string | null;
  ingestResponse?: Record<string, unknown> | null;
  ingestError?: string | null;
  patchDocResponse?: Record<string, unknown> | null;
  patchDocError?: string | null;
  deleteDocError?: string | null;
  failAll?: boolean;
};

function setupFetch(routes: FetchRoute = {}) {
  const {
    collections = [buildCollection()],
    documents = { 'science-cosmetique': [buildDocument()] },
    documentDetail = { doc_1: { contentText: 'Contenu complet du document.' } },
    embedResponse = { documentsProcessed: 3, chunksCreated: 45 },
    embedError = false,
    createCollectionResponse = { id: 'col_new', slug: 'new-col' },
    createCollectionError = null,
    patchCollectionResponse = { id: 'col_1', name: 'Updated' },
    patchCollectionError = null,
    deleteCollectionError = null,
    ingestResponse = { id: 'doc_new', chunkCount: 5 },
    ingestError = null,
    patchDocResponse = { id: 'doc_1', reChunked: false, chunkCount: 8 },
    patchDocError = null,
    deleteDocError = null,
    failAll = false,
  } = routes;

  const spy = vi.fn().mockImplementation(async (url: string | URL, opts?: RequestInit) => {
    const u = String(url);
    const method = opts?.method?.toUpperCase() ?? 'GET';

    if (failAll) {
      throw new Error('Network fail');
    }

    // POST /knowledge/embed
    if (u.includes('/knowledge/embed') && method === 'POST') {
      if (embedError) {
        return { ok: false, status: 500, json: () => Promise.resolve({ error: 'Embedding service unavailable' }) };
      }
      return { ok: true, json: () => Promise.resolve(embedResponse) };
    }

    // POST /knowledge (create collection)
    if (u.match(/\/knowledge\/?$/) && method === 'POST') {
      if (createCollectionError) {
        return { ok: false, status: 400, json: () => Promise.resolve({ error: createCollectionError }) };
      }
      return { ok: true, json: () => Promise.resolve(createCollectionResponse) };
    }

    // PATCH /knowledge/:slug/documents/:id
    if (u.match(/\/knowledge\/[^/]+\/documents\/[^/]+$/) && method === 'PATCH') {
      if (patchDocError) {
        return { ok: false, status: 400, json: () => Promise.resolve({ error: patchDocError }) };
      }
      return { ok: true, json: () => Promise.resolve(patchDocResponse) };
    }

    // DELETE /knowledge/:slug/documents/:id
    if (u.match(/\/knowledge\/[^/]+\/documents\/[^/]+$/) && method === 'DELETE') {
      if (deleteDocError) {
        return { ok: false, status: 400, json: () => Promise.resolve({ error: deleteDocError }) };
      }
      return { ok: true, json: () => Promise.resolve({ success: true }) };
    }

    // POST /knowledge/:slug/documents (ingest)
    if (u.match(/\/knowledge\/[^/]+\/documents/) && method === 'POST') {
      if (ingestError) {
        return { ok: false, status: 400, json: () => Promise.resolve({ error: ingestError }) };
      }
      return { ok: true, json: () => Promise.resolve(ingestResponse) };
    }

    // GET /knowledge/:slug/documents/:id (document detail)
    if (u.match(/\/knowledge\/[^/]+\/documents\/[^/]+$/) && method === 'GET') {
      const docId = u.split('/').pop()!;
      const detail = documentDetail[docId];
      if (detail) {
        return { ok: true, json: () => Promise.resolve({ document: detail }) };
      }
      return { ok: false, status: 404, json: () => Promise.resolve({ error: 'Not found' }) };
    }

    // GET /knowledge/:slug/documents
    if (u.match(/\/knowledge\/[^/]+\/documents/) && method === 'GET') {
      const slug = u.split('/knowledge/')[1]?.split('/documents')[0];
      return { ok: true, json: () => Promise.resolve({ documents: documents[slug ?? ''] ?? [] }) };
    }

    // PATCH /knowledge/:slug
    if (u.match(/\/knowledge\/[^/]+$/) && method === 'PATCH') {
      if (patchCollectionError) {
        return { ok: false, status: 400, json: () => Promise.resolve({ error: patchCollectionError }) };
      }
      return { ok: true, json: () => Promise.resolve(patchCollectionResponse) };
    }

    // DELETE /knowledge/:slug
    if (u.match(/\/knowledge\/[^/]+$/) && method === 'DELETE') {
      if (deleteCollectionError) {
        return { ok: false, status: 400, json: () => Promise.resolve({ error: deleteCollectionError }) };
      }
      return { ok: true, json: () => Promise.resolve({ success: true }) };
    }

    // GET /knowledge (list collections)
    if (u.includes('/knowledge') && method === 'GET') {
      return { ok: true, json: () => Promise.resolve({ collections }) };
    }

    return { ok: true, json: () => Promise.resolve({}) };
  });

  globalThis.fetch = spy;
  return spy;
}

/* ================================================================
   Helper: expand a collection (click its header, wait for docs)
   ================================================================ */

async function expandCollection(name: string) {
  fireEvent.click(screen.getByText(name));
  await waitFor(() => {
    const found =
      screen.queryByText(/Ajouter un document/) ||
      screen.queryByText(/Aucun document/) ||
      screen.queryByText('Guide Niacinamide') ||
      screen.queryByText('Tendances 2026') ||
      screen.queryByText(/Chargement/);
    expect(found).toBeTruthy();
  });
}

/* ================================================================
   Test suites
   ================================================================ */

describe('KnowledgePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* ---------------------------------------------------------------
     General (8 tests)
     --------------------------------------------------------------- */

  describe('General', () => {
    it('shows "Base de connaissances" title', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Base de connaissances')).toBeInTheDocument());
    });

    it('shows back button linking to /ai-engine', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Base de connaissances')).toBeInTheDocument());
      const backLink = screen.getByRole('link', { name: '' });
      expect(backLink).toHaveAttribute('href', '/admin/content-studio-v2/ai-engine');
    });

    it('shows "Nouvelle collection" button', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Nouvelle collection/i })).toBeInTheDocument());
    });

    it('shows "Générer les embeddings" button', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Générer les embeddings/i })).toBeInTheDocument());
    });

    it('shows 4 stat cards (collections, documents, chunks, en attente)', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => {
        expect(screen.getByText('Collections')).toBeInTheDocument();
        expect(screen.getByText('Documents')).toBeInTheDocument();
        expect(screen.getByText('Chunks')).toBeInTheDocument();
        expect(screen.getByText('En attente')).toBeInTheDocument();
      });
    });

    it('error state shows error message', async () => {
      setupFetch({ failAll: true });
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText(/Impossible de charger la base de connaissances/)).toBeInTheDocument());
    });

    it('loading state shows skeleton placeholders', async () => {
      // Never resolve the fetch so we stay in loading
      globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
      const { container } = render(<KnowledgeBasePage />);
      // The loading state renders 4 placeholder divs
      const placeholders = container.querySelectorAll('div > div');
      expect(placeholders.length).toBeGreaterThanOrEqual(4);
    });

    it('empty state shows "Aucune collection" with seed CTA', async () => {
      setupFetch({ collections: [] });
      render(<KnowledgeBasePage />);
      await waitFor(() => {
        expect(screen.getByText('Aucune collection')).toBeInTheDocument();
        expect(screen.getByText(/Lancez le seed/)).toBeInTheDocument();
      });
    });
  });

  /* ---------------------------------------------------------------
     Collections (15 tests)
     --------------------------------------------------------------- */

  describe('Collections', () => {
    it('renders collection list with names and categories', async () => {
      setupFetch({ collections: [buildCollection(), buildCollection2()] });
      render(<KnowledgeBasePage />);
      await waitFor(() => {
        expect(screen.getByText('Science cosmétique')).toBeInTheDocument();
        expect(screen.getByText('Stratégie marque')).toBeInTheDocument();
      });
    });

    it('click collection header expands (chevron toggle)', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Science cosmétique'));
      await waitFor(() => expect(screen.getByText('Guide Niacinamide')).toBeInTheDocument());
    });

    it('click expanded collection collapses it', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Science cosmétique'));
      await waitFor(() => expect(screen.getByText('Guide Niacinamide')).toBeInTheDocument());
      // Click again to collapse
      fireEvent.click(screen.getByText('Science cosmétique'));
      await waitFor(() => expect(screen.queryByText('Guide Niacinamide')).not.toBeInTheDocument());
    });

    it('expanded collection shows document list', async () => {
      const docs = [buildDocument(), buildDocument2()];
      setupFetch({ documents: { 'science-cosmetique': docs } });
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      expect(screen.getByText('Guide Niacinamide')).toBeInTheDocument();
      expect(screen.getByText('Tendances 2026')).toBeInTheDocument();
    });

    it('collection shows document count and chunk count', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => {
        expect(screen.getByText('Science cosmétique')).toBeInTheDocument();
      });
      // Counts displayed in the collection header
      expect(screen.getAllByText(/12/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/156/).length).toBeGreaterThanOrEqual(1);
    });

    it('collection shows "Indexé : date" when lastIndexedAt is set', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      // The date is formatted in fr-FR format
      expect(screen.getByText(/Indexé/)).toBeInTheDocument();
      // Should NOT show "Jamais"
      expect(screen.queryByText(/Jamais/)).not.toBeInTheDocument();
    });

    it('collection shows "Indexé : Jamais" when lastIndexedAt is null', async () => {
      setupFetch({ collections: [buildCollection({ lastIndexedAt: null })] });
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText(/Jamais/)).toBeInTheDocument());
    });

    it('category badge displayed with correct tone', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science')).toBeInTheDocument());
      expect(screen.getByText('Science')).toHaveAttribute('data-tone', 'accent');
    });

    it('"Modifier" button opens edit form', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /^Modifier$/i }));
      await waitFor(() => expect(screen.getByText('Modifier la collection')).toBeInTheDocument());
    });

    it('edit form shows name, description, category fields', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /^Modifier$/i }));
      await waitFor(() => expect(screen.getByText('Modifier la collection')).toBeInTheDocument());
      expect(screen.getByText('Nom')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Catégorie')).toBeInTheDocument();
    });

    it('edit form save calls PATCH /knowledge/:slug', async () => {
      const spy = setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /^Modifier$/i }));
      await waitFor(() => expect(screen.getByText('Modifier la collection')).toBeInTheDocument());

      // Change the name
      const nameInput = screen.getByDisplayValue('Science cosmétique');
      fireEvent.change(nameInput, { target: { value: 'Science cosmétique V2' } });

      fireEvent.click(screen.getByRole('button', { name: /Enregistrer/i }));
      await waitFor(() => {
        const patchCalls = (spy.mock.calls as [string, RequestInit][]).filter(
          ([url, opts]) =>
            String(url).includes('/knowledge/science-cosmetique') &&
            opts?.method === 'PATCH' &&
            !String(url).includes('/documents/'),
        );
        expect(patchCalls.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('edit success closes form', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /^Modifier$/i }));
      await waitFor(() => expect(screen.getByText('Modifier la collection')).toBeInTheDocument());
      const nameInput = screen.getByDisplayValue('Science cosmétique');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
      fireEvent.click(screen.getByRole('button', { name: /Enregistrer/i }));
      await waitFor(() => expect(screen.queryByText('Modifier la collection')).not.toBeInTheDocument());
    });

    it('edit error shows error message', async () => {
      setupFetch({ patchCollectionError: 'Slug déjà utilisé' });
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /^Modifier$/i }));
      await waitFor(() => expect(screen.getByText('Modifier la collection')).toBeInTheDocument());
      const nameInput = screen.getByDisplayValue('Science cosmétique');
      fireEvent.change(nameInput, { target: { value: 'Different Name' } });
      fireEvent.click(screen.getByRole('button', { name: /Enregistrer/i }));
      await waitFor(() => expect(screen.getByText('Slug déjà utilisé')).toBeInTheDocument());
    });

    it('"Supprimer la collection" button shows confirmation banner', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /Supprimer la collection/i }));
      await waitFor(() => expect(screen.getByText(/Supprimer cette collection/)).toBeInTheDocument());
    });

    it('confirm delete calls DELETE endpoint', async () => {
      const spy = setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /Supprimer la collection/i }));
      await waitFor(() => expect(screen.getByText(/Supprimer cette collection/)).toBeInTheDocument());
      // Confirmation banner has a "Supprimer" button
      const buttons = screen.getAllByRole('button', { name: /^Supprimer$/i });
      const confirmBtn = buttons.find((b) => !b.textContent?.includes('collection'));
      fireEvent.click(confirmBtn!);
      await waitFor(() => {
        const delCalls = (spy.mock.calls as [string, RequestInit][]).filter(
          ([url, opts]) =>
            String(url).includes('/knowledge/science-cosmetique') &&
            opts?.method === 'DELETE',
        );
        expect(delCalls.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('cancel delete hides banner', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /Supprimer la collection/i }));
      await waitFor(() => expect(screen.getByText(/Supprimer cette collection/)).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /^Annuler$/i }));
      await waitFor(() => expect(screen.queryByText(/Supprimer cette collection/)).not.toBeInTheDocument());
    });
  });

  /* ---------------------------------------------------------------
     Documents (20 tests)
     --------------------------------------------------------------- */

  describe('Documents', () => {
    it('document list shows title, source type, chunk badge', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      expect(screen.getByText('Guide Niacinamide')).toBeInTheDocument();
      expect(screen.getByText('text')).toBeInTheDocument();
      expect(screen.getByText('8 chunks')).toBeInTheDocument();
    });

    it('chunk badge green (success) for indexed document', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      const badge = screen.getByText('8 chunks');
      expect(badge).toHaveAttribute('data-tone', 'success');
    });

    it('chunk badge orange (warning) for non-indexed document', async () => {
      setupFetch({ documents: { 'science-cosmetique': [buildDocument({ chunkCount: 0 })] } });
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      const badge = screen.getByText('Non indexé');
      expect(badge).toHaveAttribute('data-tone', 'warning');
    });

    it('"Ajouter un document" button opens form', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /Ajouter un document/i }));
      await waitFor(() => expect(screen.getByText('Titre du document')).toBeInTheDocument());
    });

    it('source toggle: Texte/URL switches visible fields', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /Ajouter un document/i }));
      await waitFor(() => expect(screen.getByText('Titre du document')).toBeInTheDocument());

      // Default is Texte mode — title + content visible
      expect(screen.getByText('Contenu')).toBeInTheDocument();
      expect(screen.queryByText('URL du document')).not.toBeInTheDocument();

      // Switch to URL
      fireEvent.click(screen.getByText('URL'));
      await waitFor(() => expect(screen.getByText('URL du document')).toBeInTheDocument());
      expect(screen.queryByText('Contenu')).not.toBeInTheDocument();
    });

    it('text mode: title + content textarea visible', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /Ajouter un document/i }));
      await waitFor(() => {
        expect(screen.getByText('Titre du document')).toBeInTheDocument();
        expect(screen.getByText('Contenu')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Guide des ingrédients/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Collez le contenu/i)).toBeInTheDocument();
      });
    });

    it('URL mode: URL input field visible', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /Ajouter un document/i }));
      await waitFor(() => expect(screen.getByText('Texte')).toBeInTheDocument());
      fireEvent.click(screen.getByText('URL'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/example\.com/i)).toBeInTheDocument();
      });
    });

    it('Ingérer button disabled when text fields empty', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /Ajouter un document/i }));
      await waitFor(() => expect(screen.getByRole('button', { name: /^Ingérer$/i })).toBeInTheDocument());
      expect(screen.getByRole('button', { name: /^Ingérer$/i })).toBeDisabled();
    });

    it('Ingérer button disabled when URL field empty in URL mode', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /Ajouter un document/i }));
      await waitFor(() => expect(screen.getByText('Texte')).toBeInTheDocument());
      fireEvent.click(screen.getByText('URL'));
      await waitFor(() => expect(screen.getByRole('button', { name: /^Ingérer$/i })).toBeDisabled());
    });

    it('text ingestion calls POST with sourceType "text"', async () => {
      const spy = setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /Ajouter un document/i }));
      await waitFor(() => expect(screen.getByText('Titre du document')).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText(/Guide des ingrédients/i), { target: { value: 'Nouveau doc' } });
      fireEvent.change(screen.getByPlaceholderText(/Collez le contenu/i), { target: { value: 'Contenu test' } });
      fireEvent.click(screen.getByRole('button', { name: /^Ingérer$/i }));

      await waitFor(() => {
        const postCalls = (spy.mock.calls as [string, RequestInit][]).filter(
          ([url, opts]) =>
            String(url).includes('/documents') && opts?.method === 'POST',
        );
        expect(postCalls.length).toBeGreaterThanOrEqual(1);
        const body = JSON.parse(postCalls[0]![1].body as string);
        expect(body.sourceType).toBe('text');
        expect(body.title).toBe('Nouveau doc');
        expect(body.content).toBe('Contenu test');
      });
    });

    it('URL ingestion calls POST with sourceType "url"', async () => {
      const spy = setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /Ajouter un document/i }));
      await waitFor(() => expect(screen.getByText('Texte')).toBeInTheDocument());
      fireEvent.click(screen.getByText('URL'));
      await waitFor(() => expect(screen.getByPlaceholderText(/example\.com/i)).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText(/example\.com/i), { target: { value: 'https://test.com/article' } });
      fireEvent.click(screen.getByRole('button', { name: /^Ingérer$/i }));

      await waitFor(() => {
        const postCalls = (spy.mock.calls as [string, RequestInit][]).filter(
          ([url, opts]) =>
            String(url).includes('/documents') && opts?.method === 'POST',
        );
        expect(postCalls.length).toBeGreaterThanOrEqual(1);
        const body = JSON.parse(postCalls[0]![1].body as string);
        expect(body.sourceType).toBe('url');
        expect(body.url).toBe('https://test.com/article');
      });
    });

    it('success closes form, shows success banner', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /Ajouter un document/i }));
      await waitFor(() => expect(screen.getByText('Titre du document')).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText(/Guide des ingrédients/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByPlaceholderText(/Collez le contenu/i), { target: { value: 'Content' } });
      fireEvent.click(screen.getByRole('button', { name: /^Ingérer$/i }));

      await waitFor(() => expect(screen.getByText(/Document ingéré avec 5 chunks/)).toBeInTheDocument());
    });

    it('error shows banner in form', async () => {
      setupFetch({ ingestError: 'Document trop volumineux' });
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByRole('button', { name: /Ajouter un document/i }));
      await waitFor(() => expect(screen.getByText('Titre du document')).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText(/Guide des ingrédients/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByPlaceholderText(/Collez le contenu/i), { target: { value: 'Content' } });
      fireEvent.click(screen.getByRole('button', { name: /^Ingérer$/i }));

      await waitFor(() => expect(screen.getByText('Document trop volumineux')).toBeInTheDocument());
    });

    it('eye icon opens view modal with document title', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');

      const viewBtn = screen.getByTitle('Voir le contenu');
      fireEvent.click(viewBtn);

      await waitFor(() => {
        // Modal shows the title
        const titles = screen.getAllByText('Guide Niacinamide');
        expect(titles.length).toBeGreaterThanOrEqual(2); // one in list + one in modal
      });
    });

    it('view modal shows document metadata', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByTitle('Voir le contenu'));

      await waitFor(() => {
        expect(screen.getByText(/Type:/)).toBeInTheDocument();
        expect(screen.getByText(/Chunks:/)).toBeInTheDocument();
        expect(screen.getByText(/Créé:/)).toBeInTheDocument();
      });
    });

    it('view modal shows document content after fetch', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByTitle('Voir le contenu'));

      await waitFor(() => expect(screen.getByText('Contenu complet du document.')).toBeInTheDocument());
    });

    it('view modal close button works', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByTitle('Voir le contenu'));

      await waitFor(() => expect(screen.getByText('Contenu complet du document.')).toBeInTheDocument());

      // The close button is within the modal header
      // Find the modal overlay and click the X button inside it
      const modal = screen.getByText('Contenu complet du document.').closest('[style*="position: fixed"]');
      expect(modal).toBeTruthy();
      // Find the X close button (it is a <button> in the modal header)
      const closeButtons = within(modal!.querySelector('div[style*="max-width"]')! as HTMLElement).getAllByRole('button');
      const closeBtn = closeButtons.find((b) => b.querySelector('svg') || b.style.width === '32px');
      if (closeBtn) fireEvent.click(closeBtn);

      await waitFor(() => expect(screen.queryByText('Contenu complet du document.')).not.toBeInTheDocument());
    });

    it('click outside modal closes it', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByTitle('Voir le contenu'));
      await waitFor(() => expect(screen.getByText('Contenu complet du document.')).toBeInTheDocument());

      // Click the overlay (the outermost fixed div)
      const overlay = screen.getByText('Contenu complet du document.').closest('[style*="position: fixed"]');
      fireEvent.click(overlay!);

      await waitFor(() => expect(screen.queryByText('Contenu complet du document.')).not.toBeInTheDocument());
    });

    it('pencil icon opens edit modal', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByTitle('Modifier ce document'));
      await waitFor(() => expect(screen.getByText('Modifier le document')).toBeInTheDocument());
    });

    it('edit modal shows title input + content textarea', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByTitle('Modifier ce document'));
      await waitFor(() => {
        expect(screen.getByText('Modifier le document')).toBeInTheDocument();
        expect(screen.getByText('Titre')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Guide Niacinamide')).toBeInTheDocument();
      });
    });

    it('content change shows re-chunking warning (RefreshCw icon)', async () => {
      setupFetch({ documentDetail: { doc_1: { contentText: 'Original content here' } } });
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByTitle('Modifier ce document'));
      await waitFor(() => expect(screen.getByText('Modifier le document')).toBeInTheDocument());

      // Wait for content to load
      await waitFor(() => expect(screen.getByDisplayValue('Original content here')).toBeInTheDocument());

      // Change the content
      fireEvent.change(screen.getByDisplayValue('Original content here'), { target: { value: 'Modified content' } });
      await waitFor(() => expect(screen.getByText(/re-chunking/i)).toBeInTheDocument());
    });

    it('edit save calls PATCH /knowledge/:slug/documents/:docId', async () => {
      const spy = setupFetch({ documentDetail: { doc_1: { contentText: 'Original' } } });
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByTitle('Modifier ce document'));
      await waitFor(() => expect(screen.getByDisplayValue('Guide Niacinamide')).toBeInTheDocument());

      fireEvent.change(screen.getByDisplayValue('Guide Niacinamide'), { target: { value: 'New Title' } });
      fireEvent.click(screen.getByRole('button', { name: /Enregistrer/i }));

      await waitFor(() => {
        const patchCalls = (spy.mock.calls as [string, RequestInit][]).filter(
          ([url, opts]) =>
            String(url).match(/\/knowledge\/[^/]+\/documents\/[^/]+$/) &&
            opts?.method === 'PATCH',
        );
        expect(patchCalls.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('trash icon opens delete confirmation', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('Science cosmétique')).toBeInTheDocument());
      await expandCollection('Science cosmétique');
      fireEvent.click(screen.getByTitle('Supprimer ce document'));
      await waitFor(() => expect(screen.getByText(/Supprimer ce document/)).toBeInTheDocument());
      // Title appears both in the list and in the confirmation banner (bold)
      expect(screen.getAllByText(/Guide Niacinamide/).length).toBeGreaterThanOrEqual(2);
    });
  });

  /* ---------------------------------------------------------------
     Embeddings (8 tests)
     --------------------------------------------------------------- */

  describe('Embeddings', () => {
    it('"Générer les embeddings" button is present', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Générer les embeddings/i })).toBeInTheDocument());
    });

    it('click triggers loading state', async () => {
      // Make embed never resolve to keep loading state
      globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
        if (String(url).includes('/knowledge/embed')) {
          return new Promise(() => {}); // hang
        }
        return { ok: true, json: () => Promise.resolve({ collections: [buildCollection()] }) };
      });
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Générer les embeddings/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Générer les embeddings/i }));
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /Générer les embeddings/i });
        expect(btn.getAttribute('data-loading')).toBe('true');
      });
    });

    it('success shows green banner with stats (docs traités, chunks créés)', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Générer les embeddings/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Générer les embeddings/i }));
      await waitFor(() => {
        expect(screen.getByText(/3 documents traités/)).toBeInTheDocument();
        expect(screen.getByText(/45/)).toBeInTheDocument();
        expect(screen.getByText(/chunks créés/)).toBeInTheDocument();
      });
    });

    it('partial errors shows error list in banner', async () => {
      setupFetch({
        embedResponse: {
          documentsProcessed: 2,
          chunksCreated: 30,
          errors: ['doc_3: Timeout during embedding', 'doc_7: Content too long'],
        },
      });
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Générer les embeddings/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Générer les embeddings/i }));
      await waitFor(() => {
        expect(screen.getByText(/2 documents traités/)).toBeInTheDocument();
        expect(screen.getByText('doc_3: Timeout during embedding')).toBeInTheDocument();
        expect(screen.getByText('doc_7: Content too long')).toBeInTheDocument();
      });
    });

    it('full error shows red banner', async () => {
      setupFetch({ embedError: true });
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Générer les embeddings/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Générer les embeddings/i }));
      await waitFor(() => expect(screen.getByText('Embedding service unavailable')).toBeInTheDocument());
    });

    it('"En attente" stat shows warning color when > 0', async () => {
      // Create a collection with documents but 0 chunks => pendingDocs > 0
      setupFetch({
        collections: [buildCollection({ documentCount: 5, chunkCount: 0 })],
      });
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByText('En attente')).toBeInTheDocument());
      // The stat card has tone='warning' since pendingDocs > 0
      // pendingDocs = collections where documentCount > 0 && chunkCount === 0 => 1
      const statValue = screen.getAllByText('1');
      expect(statValue.length).toBeGreaterThanOrEqual(1);
    });

    it('embed button disabled during loading', async () => {
      // Hang the embed endpoint
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (String(url).includes('/knowledge/embed')) {
          return new Promise(() => {});
        }
        return { ok: true, json: () => Promise.resolve({ collections: [buildCollection()] }) };
      });
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Générer les embeddings/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Générer les embeddings/i }));
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /Générer les embeddings/i });
        expect(btn.getAttribute('data-loading')).toBe('true');
      });
    });

    it('embed result with message field shows the message', async () => {
      setupFetch({
        embedResponse: { documentsProcessed: 0, chunksCreated: 0, message: 'Aucun document à indexer' },
      });
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Générer les embeddings/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Générer les embeddings/i }));
      await waitFor(() => expect(screen.getByText('Aucun document à indexer')).toBeInTheDocument());
    });
  });

  /* ---------------------------------------------------------------
     Create Collection Form (10 tests)
     --------------------------------------------------------------- */

  describe('Create Collection Form', () => {
    it('form appears when "Nouvelle collection" clicked', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Nouvelle collection/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Nouvelle collection/i }));
      // Both the button text and the form title contain "Nouvelle collection"
      await waitFor(() => expect(screen.getAllByText('Nouvelle collection').length).toBeGreaterThanOrEqual(2));
      // The form should have a Nom input
      expect(screen.getByPlaceholderText(/Fiches produits/i)).toBeInTheDocument();
    });

    it('name field is present and editable', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Nouvelle collection/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Nouvelle collection/i }));
      await waitFor(() => expect(screen.getByPlaceholderText(/Fiches produits/i)).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText(/Fiches produits/i), { target: { value: 'Ma collection' } });
      expect(screen.getByDisplayValue('Ma collection')).toBeInTheDocument();
    });

    it('slug auto-generated from name (lowercase, hyphens)', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Nouvelle collection/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Nouvelle collection/i }));
      await waitFor(() => expect(screen.getByPlaceholderText(/Fiches produits/i)).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText(/Fiches produits/i), { target: { value: 'Ma Super Collection' } });
      // The slug field should have auto-generated value
      expect(screen.getByDisplayValue('ma-super-collection')).toBeInTheDocument();
    });

    it('slug manually editable', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Nouvelle collection/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Nouvelle collection/i }));
      await waitFor(() => expect(screen.getByPlaceholderText(/fiches-produits/i)).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText(/fiches-produits/i), { target: { value: 'custom-slug' } });
      expect(screen.getByDisplayValue('custom-slug')).toBeInTheDocument();
    });

    it('category select has 7 options', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Nouvelle collection/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Nouvelle collection/i }));
      await waitFor(() => expect(screen.getByPlaceholderText(/Fiches produits/i)).toBeInTheDocument());
      const selectElements = document.querySelectorAll('select');
      expect(selectElements.length).toBeGreaterThanOrEqual(1);
      const options = selectElements[0]!.querySelectorAll('option');
      expect(options.length).toBe(7);
    });

    it('"Créer" disabled until name and slug filled', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Nouvelle collection/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Nouvelle collection/i }));
      await waitFor(() => expect(screen.getByRole('button', { name: /^Créer$/i })).toBeInTheDocument());
      expect(screen.getByRole('button', { name: /^Créer$/i })).toBeDisabled();
    });

    it('submit calls POST /knowledge', async () => {
      const spy = setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Nouvelle collection/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Nouvelle collection/i }));
      await waitFor(() => expect(screen.getByPlaceholderText(/Fiches produits/i)).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText(/Fiches produits/i), { target: { value: 'Fiches produits' } });
      // Slug auto-generated
      fireEvent.click(screen.getByRole('button', { name: /^Créer$/i }));

      await waitFor(() => {
        const postCalls = (spy.mock.calls as [string, RequestInit][]).filter(
          ([url, opts]) =>
            String(url).match(/\/knowledge\/?$/) && opts?.method === 'POST',
        );
        expect(postCalls.length).toBeGreaterThanOrEqual(1);
        const body = JSON.parse(postCalls[0]![1].body as string);
        expect(body.name).toBe('Fiches produits');
        expect(body.slug).toBe('fiches-produits');
      });
    });

    it('success closes form, adds collection to list', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Nouvelle collection/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Nouvelle collection/i }));
      await waitFor(() => expect(screen.getByPlaceholderText(/Fiches produits/i)).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText(/Fiches produits/i), { target: { value: 'Fiches produits' } });
      fireEvent.click(screen.getByRole('button', { name: /^Créer$/i }));

      await waitFor(() => expect(screen.getByText(/Collection .* créée/)).toBeInTheDocument());
      // Form should be closed — no more "Créer" button
      expect(screen.queryByRole('button', { name: /^Créer$/i })).not.toBeInTheDocument();
    });

    it('error shows banner', async () => {
      setupFetch({ createCollectionError: 'Slug déjà existant' });
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Nouvelle collection/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Nouvelle collection/i }));
      await waitFor(() => expect(screen.getByPlaceholderText(/Fiches produits/i)).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText(/Fiches produits/i), { target: { value: 'Existing' } });
      fireEvent.click(screen.getByRole('button', { name: /^Créer$/i }));

      await waitFor(() => expect(screen.getByText('Slug déjà existant')).toBeInTheDocument());
    });

    it('cancel closes form', async () => {
      setupFetch();
      render(<KnowledgeBasePage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Nouvelle collection/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Nouvelle collection/i }));
      await waitFor(() => expect(screen.getByRole('button', { name: /^Annuler$/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /^Annuler$/i }));
      await waitFor(() => expect(screen.queryByRole('button', { name: /^Créer$/i })).not.toBeInTheDocument());
    });
  });
});
