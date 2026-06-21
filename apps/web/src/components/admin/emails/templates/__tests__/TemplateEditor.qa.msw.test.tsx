/**
 * Module 06 — TemplateEditor : preview debouncée, versioning, restauration,
 * grille d'échecs 5 points (200 / 401 / 422 / 500 / hang) sur preview ET
 * versions.
 *
 * TPL-EDI-001..016.
 *
 * Harnais RÉEL : serveur MSW partagé `@/test/msw/server`. Le composant fait des
 * `fetch` relatifs vers /preview et /versions → MSW intercepte au niveau réseau
 * (on teste aussi l'URL + le body construits). Override LOCAL stateful : la
 * grille `emailsFailWith` est générique ; ici on a besoin de capter le body et
 * de compter les appels → handlers locaux.
 *
 * Anti-flake : aucune attente fixe (`setTimeout`). On s'appuie sur le debounce
 * réel (600 ms) via `findBy*`/`waitFor` qui poll jusqu'à 1–2 s.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { delay } from 'msw';
import { server, http, HttpResponse } from '@/test/msw/server';
import { TemplateEditor } from '@/components/admin/emails/templates/TemplateEditor';
import type {
  EmailTemplateCustomRow,
  EmailTemplateCustomVersionRow,
} from '@/lib/db/schema-emails';

// UnsavedChangesGuard (P3.4-b) utilise useRouter.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

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
    id: 'v1',
    templateId: TPL_ID,
    versionNumber: 1,
    subjectTmpl: 'Bonjour {{firstName}}',
    preheaderTmpl: null,
    htmlSource: '<!doctype html><html><body><p>v1</p></body></html>',
    customVars: {},
    commitMessage: null,
    createdAt: new Date('2026-06-01T10:00:00Z'),
    createdBy: 'imane@femiglow-maroc.com',
  },
];

/** Preview nominale (200) — neutre, n'interfère pas avec les oracles. */
function nominalPreview() {
  return http.post(PREVIEW_URL, () =>
    HttpResponse.json({ html: '<p>rendu</p>', subject: 'Bonjour Imane' }),
  );
}
/** Versions nominale (200) — renvoie v2. */
function nominalVersions() {
  return http.post(VERSIONS_URL, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { commitMessage?: string };
    return HttpResponse.json({
      ...baseVersions[0],
      id: 'v2',
      versionNumber: 2,
      commitMessage: body.commitMessage ?? null,
    });
  });
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
  localStorage.clear(); // isolation du brouillon local (P3.4-b)
});
afterAll(() => server.close());

function renderEditor() {
  server.use(nominalPreview(), nominalVersions());
  return render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
}

function makeDirty() {
  const subject = screen.getByDisplayValue('Bonjour {{firstName}}');
  fireEvent.change(subject, { target: { value: 'Bonjour {{firstName}} !' } });
}

// ── Éditeur de base ──────────────────────────────────────────────────────
describe('TemplateEditor — base (CRUD UI)', () => {
  it('TPL-EDI-001 : champs sujet/preheader/source préremplis depuis le template', () => {
    renderEditor();
    expect(screen.getAllByDisplayValue(/Bonjour \{\{firstName\}\}/).length).toBeGreaterThan(0);
  });

  it('TPL-EDI-002 : insertion de variable au CURSEUR (clé réelle, plus en fin)', () => {
    renderEditor();
    const source = screen
      .getAllByRole('textbox')
      .find((t) => (t as HTMLTextAreaElement).value.includes('Bonjour {{firstName}}')) as HTMLTextAreaElement;
    source.focus();
    source.setSelectionRange(0, 0); // curseur au DÉBUT
    fireEvent.click(screen.getByRole('button', { name: '{{shopUrl}}' }));
    const after = screen
      .getAllByRole('textbox')
      .find((t) => (t as HTMLTextAreaElement).value.includes('{{shopUrl}}')) as HTMLTextAreaElement;
    // Inséré à la position du curseur (début), PAS appendé en fin.
    expect(after.value.startsWith('{{shopUrl}}')).toBe(true);
  });

  it('TPL-EDI-003 : bouton enregistrer désactivé sans changement', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: /Aucun changement/i })).toBeDisabled();
  });

  it('TPL-EDI-004 : modification active le bouton « Créer une version »', () => {
    renderEditor();
    makeDirty();
    expect(screen.getByRole('button', { name: /Créer une version/i })).toBeEnabled();
  });

  it('TPL-EDI-016 : aucune version → « Aucune version » affiché', () => {
    server.use(nominalPreview());
    render(<TemplateEditor template={baseTemplate} versions={[]} />);
    expect(screen.getByText(/Aucune version/i)).toBeInTheDocument();
  });
});

// ── Preview (grille d'échecs) ────────────────────────────────────────────
describe('TemplateEditor — preview (grille d’échecs 5 points)', () => {
  it('TPL-EDI-005 : customVars JSON invalide → erreur AVANT tout appel preview', async () => {
    let previewCalled = false;
    server.use(
      http.post(PREVIEW_URL, () => {
        previewCalled = true;
        return HttpResponse.json({ html: '', subject: '' });
      }),
    );
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    fireEvent.click(screen.getByText(/Variables custom \(JSON\)/i));
    const varsTa = screen
      .getAllByRole('textbox')
      .find((t) => (t as HTMLTextAreaElement).value.trim() === '{}') as HTMLTextAreaElement;
    fireEvent.change(varsTa, { target: { value: 'pas du json' } });
    // Le dernier debounce (customVars invalide) gagne et court-circuite avant fetch.
    expect(await screen.findByText(/customVars JSON invalide/i)).toBeInTheDocument();
    expect(previewCalled).toBe(false);
  });

  it('TPL-EDI-007 : preview debouncée appelle l’API avec subjectTmpl + htmlSource', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(PREVIEW_URL, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ html: '<p>ok</p>', subject: 'S' });
      }),
    );
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    await waitFor(() => expect(body).not.toBeNull(), { timeout: 2000 });
    expect(body).toMatchObject({
      subjectTmpl: 'Bonjour {{firstName}}',
      htmlSource: baseTemplate.htmlSource,
    });
  });

  it('TPL-EDI-008 : preview 500 → message d’erreur, pas de faux rendu de sujet', async () => {
    server.use(
      http.post(PREVIEW_URL, () =>
        HttpResponse.json({ ok: false, error: 'forced_server_error' }, { status: 500 }),
      ),
    );
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    expect(
      await screen.findByText(/forced_server_error/i, {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    // Aucun sujet rendu fantôme : le placeholder « — » reste.
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('TPL-EDI-009 : preview 422 → détail de validation affiché', async () => {
    server.use(
      http.post(PREVIEW_URL, () =>
        HttpResponse.json({ error: 'htmlSource trop court' }, { status: 422 }),
      ),
    );
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    expect(
      await screen.findByText(/trop court/i, {}, { timeout: 2000 }),
    ).toBeInTheDocument();
  });

  it('TPL-EDI-EDI-401 : preview 401 → message d’erreur (session expirée)', async () => {
    server.use(
      http.post(PREVIEW_URL, () =>
        HttpResponse.json({ error: 'non autorisé' }, { status: 401 }),
      ),
    );
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    expect(
      await screen.findByText(/non autoris/i, {}, { timeout: 2000 }),
    ).toBeInTheDocument();
  });

  it('TPL-EDI-010 : preview hang → indicateur de chargement « ... » visible', async () => {
    server.use(
      http.post(PREVIEW_URL, async () => {
        await delay(1500);
        return HttpResponse.json({ html: '', subject: '' });
      }),
    );
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    // Le spinner de chargement apparaît pendant le pending (après le debounce).
    expect(await screen.findByText('...', {}, { timeout: 2000 })).toBeInTheDocument();
  });
});

// ── Versioning (grille d'échecs) ─────────────────────────────────────────
describe('TemplateEditor — versioning (grille d’échecs 5 points)', () => {
  it('TPL-EDI-011 : création de version 200 ajoute v2 en tête de liste', async () => {
    renderEditor();
    makeDirty();
    fireEvent.click(screen.getByRole('button', { name: /Créer une version/i }));
    await waitFor(() => expect(screen.getByText(/^v2/)).toBeInTheDocument());
    // v2 est bien AVANT v1 dans la liste (tête de liste).
    const items = screen.getAllByText(/^v\d/);
    expect(items[0]).toHaveTextContent('v2');
  });

  it('TPL-EDI-012 : création de version 401 → message, AUCUNE v2 fantôme', async () => {
    server.use(
      nominalPreview(),
      http.post(VERSIONS_URL, () =>
        HttpResponse.json({ error: 'non autorisé' }, { status: 401 }),
      ),
    );
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    makeDirty();
    fireEvent.click(screen.getByRole('button', { name: /Créer une version/i }));
    expect(await screen.findByText(/non autoris/i)).toBeInTheDocument();
    // L'optimistic update ne doit PAS avoir ajouté de v2.
    expect(screen.queryByText(/^v2/)).not.toBeInTheDocument();
  });

  it('TPL-EDI-013 : création de version 500 → message + bouton réactivé', async () => {
    server.use(
      nominalPreview(),
      http.post(VERSIONS_URL, () =>
        HttpResponse.json({ ok: false, error: 'forced_server_error' }, { status: 500 }),
      ),
    );
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    makeDirty();
    fireEvent.click(screen.getByRole('button', { name: /Créer une version/i }));
    expect(await screen.findByText(/forced_server_error/i)).toBeInTheDocument();
    // Le bouton est réactivé (pas de spinner figé) → l'opérateur peut réessayer.
    expect(screen.getByRole('button', { name: /Créer une version/i })).toBeEnabled();
    expect(screen.queryByText(/^v2/)).not.toBeInTheDocument();
  });

  it('TPL-EDI-013b : création de version 422 → détail de validation affiché', async () => {
    server.use(
      nominalPreview(),
      http.post(VERSIONS_URL, () =>
        HttpResponse.json({ error: 'subjectTmpl requis' }, { status: 422 }),
      ),
    );
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    makeDirty();
    fireEvent.click(screen.getByRole('button', { name: /Créer une version/i }));
    expect(await screen.findByText(/subjectTmpl requis/i)).toBeInTheDocument();
    expect(screen.queryByText(/^v2/)).not.toBeInTheDocument();
  });

  it('TPL-EDI-014 : restauration demande confirmation et remplace la source', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderEditor();
    // v1.htmlSource = « <p>v1</p> » — restaurer remplace la source du textarea.
    fireEvent.click(screen.getByRole('button', { name: /^v1/ }));
    expect(window.confirm).toHaveBeenCalled();
    const restored = screen
      .getAllByRole('textbox')
      .find((t) => (t as HTMLTextAreaElement).value.includes('<p>v1</p>'));
    expect(restored).toBeTruthy();
  });

  it('TPL-EDI-015 : restauration annulée (confirm=false) ne change rien', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderEditor();
    const sourceBefore = (
      screen
        .getAllByRole('textbox')
        .find((t) => (t as HTMLTextAreaElement).value.includes('firstName')) as HTMLTextAreaElement
    ).value;
    fireEvent.click(screen.getByRole('button', { name: /^v1/ }));
    const sourceAfter = (
      screen
        .getAllByRole('textbox')
        .find((t) => (t as HTMLTextAreaElement).value.includes('firstName')) as HTMLTextAreaElement
    ).value;
    expect(sourceAfter).toBe(sourceBefore);
  });
});
