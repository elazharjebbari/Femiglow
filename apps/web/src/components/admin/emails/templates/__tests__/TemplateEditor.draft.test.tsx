// @vitest-environment jsdom
/**
 * F07 P3.4-b (Lot 1) — câblage du brouillon local dans TemplateEditor :
 * détection/restauration au montage, application, ignore (purge), autosave.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { TemplateEditor } from '../TemplateEditor';
import { templateDraftKey, TEMPLATE_DRAFT_SCHEMA_VERSION } from '../use-template-draft';
import type { EmailTemplateCustomRow, EmailTemplateCustomVersionRow } from '@/lib/db/schema-emails';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const TPL_ID = 'tpl-1';
const KEY = templateDraftKey(TPL_ID);

const template: EmailTemplateCustomRow = {
  id: TPL_ID,
  slug: 'welcome',
  name: 'Welcome',
  description: null,
  subjectTmpl: 'Bonjour {{firstName}}',
  preheaderTmpl: null,
  htmlSource: '<!doctype html><html><body><p>serveur</p></body></html>',
  customVars: {},
  activeVersionId: null,
  createdBy: 'imane@femiglow-maroc.com',
  createdAt: new Date('2026-06-01T10:00:00Z'),
  updatedAt: new Date('2026-06-01T10:00:00Z'), // ANCIEN → un brouillon récent est candidat
  deletedAt: null,
};
const versions: EmailTemplateCustomVersionRow[] = [];

function seedDraft(data: { subject?: string; htmlSource?: string } = {}) {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      v: TEMPLATE_DRAFT_SCHEMA_VERSION,
      savedAt: new Date(Date.now() - 60_000).toISOString(), // il y a 1 min : frais, > updatedAt
      data: {
        subject: data.subject ?? 'Sujet BROUILLON',
        preheader: '',
        htmlSource: data.htmlSource ?? '<p>BROUILLON</p>',
        customVars: '{}',
      },
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ html: '<p>rendu</p>', subject: 'S' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
});
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('F07 — TemplateEditor brouillon local (câblage)', () => {
  it('F07-C-012 — brouillon divergent + frais → ConfirmDialog de restauration au montage', async () => {
    seedDraft();
    render(<TemplateEditor template={template} versions={versions} />);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /Restaurer le brouillon/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Restaurer le brouillon/i })).toBeInTheDocument();
  });

  it('F07-C-013 — « Restaurer » applique le brouillon aux champs', async () => {
    seedDraft({ subject: 'Sujet BROUILLON' });
    render(<TemplateEditor template={template} versions={versions} />);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: /Restaurer le brouillon/i }));
    expect(screen.getByDisplayValue('Sujet BROUILLON')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('F07-C-014 — « Ignorer » purge le brouillon et NE modifie PAS les champs', async () => {
    seedDraft();
    render(<TemplateEditor template={template} versions={versions} />);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: /Ignorer/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull(); // purgé
    expect(screen.getByDisplayValue('Bonjour {{firstName}}')).toBeInTheDocument(); // sujet serveur intact
  });

  it('F07-C-015 — éditer écrit un brouillon local (debounce) sans restauration en attente', async () => {
    render(<TemplateEditor template={template} versions={versions} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); // localStorage vide → pas de restore
    fireEvent.change(screen.getByDisplayValue('Bonjour {{firstName}}'), {
      target: { value: 'Bonjour ÉDIT' },
    });
    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull(), { timeout: 2000 });
    const rec = JSON.parse(localStorage.getItem(KEY)!);
    expect(rec.data.subject).toBe('Bonjour ÉDIT');
    expect(rec.v).toBe(TEMPLATE_DRAFT_SCHEMA_VERSION);
  });

  it('F07-C-016 — l’indicateur passe à « enregistré » après une frappe autosauvée', async () => {
    render(<TemplateEditor template={template} versions={versions} />);
    fireEvent.change(screen.getByDisplayValue('Bonjour {{firstName}}'), {
      target: { value: 'Bonjour ÉDIT 2' },
    });
    await waitFor(
      () => expect(screen.getByTestId('tpl-draft-status')).toHaveTextContent(/Brouillon local enregistré/i),
      { timeout: 2000 },
    );
  });
});
