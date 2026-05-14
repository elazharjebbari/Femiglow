/**
 * Tests P10.2 — éditeur pro features :
 *  - status pill coloré + visible
 *  - compteur description X/200
 *  - Cmd+S déclenche save
 *  - Tabs mobile (Éditer / Aperçu)
 *  - Autocomplete {{VARS}}
 *  - Preview server (debounced fetch /preview)
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/msw/server';
import { defaultLegalState, legalHandlers } from '@/test/msw/legal-handlers';
import { LegalEditor } from '../LegalEditor';

const baseProps = {
  slug: 'cgv',
  initialTitle: 'CGV',
  initialDescription: 'desc init',
  initialBodyMd: '# CGV\n\nContenu body',
  initialIncludeInSearch: false,
  status: 'draft' as const,
  version: 3,
  initialUpdatedAtMs: 1_700_000_000_000,
  templateVars: [
    { key: 'COMPANY_NAME', value: 'FemiGlow', isRequired: true },
    { key: 'COMPANY_RC', value: '', isRequired: true },
  ],
  placements: [],
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => server.use(...legalHandlers()));

describe('Status pill', () => {
  it('affiche "Brouillon · v3" pour status=draft', () => {
    render(<LegalEditor {...baseProps} />);
    expect(screen.getByText(/Brouillon · v3/)).toBeInTheDocument();
  });

  it('affiche "Publié · vN" pour status=published', () => {
    render(<LegalEditor {...baseProps} status="published" version={5} />);
    expect(screen.getByText(/Publié · v5/)).toBeInTheDocument();
  });

  it('a un anneau coloré ring-1 visible', () => {
    render(<LegalEditor {...baseProps} status="published" />);
    const pill = screen.getByText(/Publié/);
    expect(pill.className).toContain('ring-1');
    expect(pill.className).toContain('bg-emerald-50');
  });
});

describe('Compteur description', () => {
  it('affiche "X/200" et vire ambre > 180', async () => {
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} initialDescription="" />);
    const desc = screen.getByLabelText(/Description/);
    await user.type(desc, 'a'.repeat(50));
    expect(screen.getByText('50/200')).toBeInTheDocument();
    expect(screen.getByText('50/200').className).toContain('text-stone-500');
  });

  it('compteur passe ambre à 181+', async () => {
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} initialDescription={'a'.repeat(180)} />);
    const desc = screen.getByLabelText(/Description/);
    await user.type(desc, 'b');
    expect(screen.getByText('181/200').className).toContain('text-amber-700');
  });
});

describe('Raccourci Cmd+S', () => {
  it('déclenche save quand isDirty', async () => {
    let saveCalled = 0;
    server.use(
      http.patch('/api/admin/legal/cgv', () => {
        saveCalled += 1;
        return HttpResponse.json({
          id: 'lp_x',
          slug: 'cgv',
          title: 'Updated',
          description: null,
          body_md: 'x',
          status: 'draft',
          version: 4,
          updated_at: new Date().toISOString(),
        });
      }),
    );
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    const title = screen.getByDisplayValue('CGV') as HTMLInputElement;
    await user.clear(title);
    await user.type(title, 'CGV nouveau');
    await user.keyboard('{Meta>}s{/Meta}');
    await waitFor(() => expect(saveCalled).toBe(1));
  });

  it('Cmd+S ne fait rien si pas dirty', async () => {
    let saveCalled = 0;
    server.use(
      http.patch('/api/admin/legal/cgv', () => {
        saveCalled += 1;
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    await user.keyboard('{Meta>}s{/Meta}');
    await new Promise((r) => setTimeout(r, 100));
    expect(saveCalled).toBe(0);
  });
});

describe('Tabs mobile Éditer / Aperçu', () => {
  it('affiche les 2 onglets avec role=tab', () => {
    render(<LegalEditor {...baseProps} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent('Éditer');
    expect(tabs[1]).toHaveTextContent('Aperçu');
  });

  it('par défaut Éditer est sélectionné', () => {
    render(<LegalEditor {...baseProps} />);
    const editTab = screen.getByRole('tab', { name: /Éditer/ });
    expect(editTab).toHaveAttribute('aria-selected', 'true');
  });

  it('cliquer Aperçu change aria-selected', async () => {
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    await user.click(screen.getByRole('tab', { name: /Aperçu/ }));
    expect(screen.getByRole('tab', { name: /Aperçu/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /Éditer/ })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });
});

describe('Autocomplete variables', () => {
  it('saisie {{C ouvre la liste avec COMPANY_NAME, COMPANY_RC', async () => {
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    const textarea = screen.getByLabelText(/Contenu Markdown/);
    await user.click(textarea);
    await user.type(textarea, '\n\n{{{{C');
    await waitFor(() =>
      expect(screen.getByRole('listbox', { name: /Variables/ })).toBeInTheDocument(),
    );
    expect(screen.getByText('{{COMPANY_NAME}}')).toBeInTheDocument();
    expect(screen.getByText('{{COMPANY_RC}}')).toBeInTheDocument();
  });

  it('filtre par préfixe (CURRENT → CURRENT_YEAR preset)', async () => {
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    const textarea = screen.getByLabelText(/Contenu Markdown/);
    await user.click(textarea);
    await user.type(textarea, '\n\n{{{{CUR');
    await waitFor(() => expect(screen.getByText('{{CURRENT_YEAR}}')).toBeInTheDocument());
  });

  it('cliquer une suggestion insère {{KEY}} et ferme', async () => {
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    const textarea = screen.getByLabelText(/Contenu Markdown/) as HTMLTextAreaElement;
    await user.click(textarea);
    await user.type(textarea, '\n\n{{{{C');
    await waitFor(() => screen.getByRole('listbox'));
    await user.click(screen.getByText('{{COMPANY_NAME}}'));
    expect(textarea.value).toContain('{{COMPANY_NAME}}');
  });
});

describe('Preview server-side', () => {
  it('debounce 500ms + fetch /preview + render html serveur', async () => {
    let previewBody: unknown = null;
    server.use(
      http.post('/api/admin/legal/preview', async ({ request }) => {
        previewBody = await request.json();
        return HttpResponse.json({
          html: '<p>SERVER RENDERED</p>',
          headings: [],
          varsUsed: [],
        });
      }),
    );
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    const textarea = screen.getByLabelText(/Contenu Markdown/);
    await user.click(textarea);
    await user.type(textarea, '\n\nNouveau contenu');

    await waitFor(
      () => expect((previewBody as { bodyMd?: string })?.bodyMd ?? '').toContain('Nouveau contenu'),
      { timeout: 2000 },
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/Aperçu/i).innerHTML).toContain('SERVER RENDERED'),
    );
  });

  it('indicateur "✓ rendu pipeline" quand server preview OK', async () => {
    server.use(
      http.post('/api/admin/legal/preview', () =>
        HttpResponse.json({ html: '<p>x</p>', headings: [], varsUsed: [] }),
      ),
    );
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    const textarea = screen.getByLabelText(/Contenu Markdown/);
    await user.type(textarea, ' edit');
    await waitFor(() => expect(screen.getByText(/rendu pipeline/)).toBeInTheDocument(), {
      timeout: 2000,
    });
  });
});
