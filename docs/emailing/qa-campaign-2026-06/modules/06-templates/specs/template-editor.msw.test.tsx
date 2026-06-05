/**
 * TPL-EDI-* — TemplateEditor : preview debouncée, versioning, grille d'échecs.
 *
 * Le composant utilise `fetch` direct vers /preview et /versions → MSW
 * intercepte au niveau réseau (on teste aussi l'URL + le body construits).
 *
 * NB chemin : à déposer sous apps/web/src/components/admin/emails/templates/.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { delay } from 'msw';
import { server, http, HttpResponse } from '@/test/msw/server';
import { TemplateEditor } from '@/components/admin/emails/templates/TemplateEditor';
import type { EmailTemplateCustomRow, EmailTemplateCustomVersionRow } from '@/lib/db/schema-emails';

const TPL_ID = 'tpl-1';
const PREVIEW_URL = `/api/admin/emails/templates/${TPL_ID}/preview`;
const VERSIONS_URL = `/api/admin/emails/templates/${TPL_ID}/versions`;

const baseTemplate: EmailTemplateCustomRow = {
  id: TPL_ID,
  slug: 'welcome',
  name: 'Welcome',
  description: null,
  subjectTmpl: 'Bonjour {{firstName}}',
  preheaderTmpl: null,
  htmlSource: '<!doctype html><html><body><p>Bonjour {{firstName}}</p></body></html>',
  customVars: {},
  activeVersionId: null,
  createdBy: 'imane@femiglow-maroc.com',
  createdAt: new Date('2026-06-01T10:00:00Z'),
  updatedAt: new Date('2026-06-01T10:00:00Z'),
  deletedAt: null,
};

const baseVersions: EmailTemplateCustomVersionRow[] = [
  {
    id: 'v1', templateId: TPL_ID, versionNumber: 1,
    subjectTmpl: 'Bonjour {{firstName}}', preheaderTmpl: null,
    htmlSource: '<!doctype html><html><body><p>v1</p></body></html>',
    customVars: {}, commitMessage: null,
    createdAt: new Date('2026-06-01T10:00:00Z'), createdBy: 'imane@femiglow-maroc.com',
  },
];

function defaultHandlers() {
  return [
    http.post(PREVIEW_URL, () => HttpResponse.json({ html: '<p>rendu</p>', subject: 'Bonjour Imane' })),
    http.post(VERSIONS_URL, () =>
      HttpResponse.json({
        version: { ...baseVersions[0], id: 'v2', versionNumber: 2 },
      }),
    ),
  ];
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

function renderEditor() {
  server.use(...defaultHandlers());
  return render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
}

// ── Éditeur de base ──────────────────────────────────────────────────────
describe('TemplateEditor — base', () => {
  it('TPL-EDI-001 : champs préremplis depuis le template', () => {
    renderEditor();
    expect(screen.getAllByDisplayValue(/Bonjour \{\{firstName\}\}/).length).toBeGreaterThan(0);
  });

  it('TPL-EDI-002 : insertion de variable ajoute {{var}} en fin de source', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: '{{lastName}}' }));
    const source = screen.getAllByRole('textbox')
      .find((t) => (t as HTMLTextAreaElement).value.includes('{{lastName}}'));
    expect(source).toBeTruthy();
  });

  it('TPL-EDI-003 : bouton enregistrer désactivé sans changement', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: /Aucun changement/i })).toBeDisabled();
  });

  it('TPL-EDI-004 : modification active le bouton « Créer une version »', () => {
    renderEditor();
    const subject = screen.getByDisplayValue('Bonjour {{firstName}}');
    fireEvent.change(subject, { target: { value: 'Bonjour {{firstName}} !' } });
    expect(screen.getByRole('button', { name: /Créer une version/i })).toBeEnabled();
  });

  it('TPL-EDI-016 : aucune version affiche « Aucune version »', () => {
    server.use(...defaultHandlers());
    render(<TemplateEditor template={baseTemplate} versions={[]} />);
    expect(screen.getByText(/Aucune version/i)).toBeInTheDocument();
  });
});

// ── Preview (grille d'échecs) ────────────────────────────────────────────
describe('TemplateEditor — preview (grille d’échecs)', () => {
  it('TPL-EDI-005 : customVars JSON invalide → erreur, pas d’appel preview', async () => {
    let previewCalled = false;
    server.use(
      http.post(PREVIEW_URL, () => { previewCalled = true; return HttpResponse.json({ html: '', subject: '' }); }),
    );
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    fireEvent.click(screen.getByText(/Variables custom \(JSON\)/i));
    const varsTa = screen.getAllByRole('textbox')
      .find((t) => (t as HTMLTextAreaElement).value.trim() === '{}') as HTMLTextAreaElement;
    fireEvent.change(varsTa, { target: { value: 'pas du json' } });
    expect(await screen.findByText(/customVars JSON invalide/i)).toBeInTheDocument();
    expect(previewCalled).toBe(false);
  });

  it('TPL-EDI-007 : preview debouncée appelle l’API avec le bon body', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(PREVIEW_URL, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ html: '<p>ok</p>', subject: 'S' });
      }),
    );
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    await waitFor(() => expect(body).not.toBeNull(), { timeout: 2000 });
    expect(body).toMatchObject({ subjectTmpl: 'Bonjour {{firstName}}' });
  });

  it('TPL-EDI-008 : preview 500 → message d’erreur, pas de faux rendu', async () => {
    server.use(http.post(PREVIEW_URL, () => HttpResponse.json({ error: 'internal' }, { status: 500 })));
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    expect(await screen.findByText(/internal|Preview 500/i, {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('TPL-EDI-009 : preview 422 → détail de validation affiché', async () => {
    server.use(http.post(PREVIEW_URL, () => HttpResponse.json({ error: 'htmlSource trop court' }, { status: 422 })));
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    expect(await screen.findByText(/trop court/i, {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('TPL-EDI-010 : preview hang → indicateur de chargement visible', async () => {
    server.use(http.post(PREVIEW_URL, async () => { await delay(1500); return HttpResponse.json({ html: '', subject: '' }); }));
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    // L'indicateur « ... » de chargement apparaît pendant le pending.
    expect(await screen.findByText('...', {}, { timeout: 2000 })).toBeInTheDocument();
  });
});

// ── Versioning (grille d'échecs) ─────────────────────────────────────────
describe('TemplateEditor — versioning (grille d’échecs)', () => {
  function makeDirty() {
    const subject = screen.getByDisplayValue('Bonjour {{firstName}}');
    fireEvent.change(subject, { target: { value: 'Bonjour {{firstName}} !' } });
  }

  it('TPL-EDI-011 : création de version 200 ajoute en tête de liste', async () => {
    renderEditor();
    makeDirty();
    fireEvent.click(screen.getByRole('button', { name: /Créer une version/i }));
    await waitFor(() => expect(screen.getByText(/v2/i)).toBeInTheDocument());
  });

  it('TPL-EDI-012 : création de version 401 → message, liste inchangée', async () => {
    server.use(
      ...defaultHandlers(),
      http.post(VERSIONS_URL, () => HttpResponse.json({ error: 'non autorisé' }, { status: 401 })),
    );
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    makeDirty();
    fireEvent.click(screen.getByRole('button', { name: /Créer une version/i }));
    expect(await screen.findByText(/autoris/i)).toBeInTheDocument();
    // Aucune v2 fantôme ajoutée.
    expect(screen.queryByText(/v2/i)).not.toBeInTheDocument();
  });

  it('TPL-EDI-013 : création de version 500 → message générique + bouton réactivé', async () => {
    server.use(
      ...defaultHandlers(),
      http.post(VERSIONS_URL, () => HttpResponse.json({ error: 'internal' }, { status: 500 })),
    );
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    makeDirty();
    fireEvent.click(screen.getByRole('button', { name: /Créer une version/i }));
    expect(await screen.findByText(/internal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Créer une version/i })).toBeEnabled();
  });

  it('TPL-EDI-014 : restauration demande confirmation et remplace les champs', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderEditor();
    // La version 1 a htmlSource « <p>v1</p> » — restaurer remplace la source.
    fireEvent.click(screen.getByRole('button', { name: /v1/i }));
    expect(window.confirm).toHaveBeenCalled();
    const restored = screen.getAllByRole('textbox')
      .find((t) => (t as HTMLTextAreaElement).value.includes('<p>v1</p>'));
    expect(restored).toBeTruthy();
  });

  it('TPL-EDI-015 : restauration annulée ne change rien', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderEditor();
    const before = (screen.getAllByRole('textbox')
      .find((t) => (t as HTMLTextAreaElement).value.includes('firstName')) as HTMLTextAreaElement).value;
    fireEvent.click(screen.getByRole('button', { name: /v1/i }));
    const after = (screen.getAllByRole('textbox')
      .find((t) => (t as HTMLTextAreaElement).value.includes('firstName')) as HTMLTextAreaElement).value;
    expect(after).toBe(before);
  });
});
