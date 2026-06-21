/**
 * Tests TemplateEditor — basic interactions (insert var, save flow).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplateEditor } from '../TemplateEditor';
import type { EmailTemplateCustomRow, EmailTemplateCustomVersionRow } from '@/lib/db/schema-emails';

// UnsavedChangesGuard (P3.4-b) utilise useRouter.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const baseTemplate: EmailTemplateCustomRow = {
  id: 'tpl-1',
  slug: 'welcome',
  name: 'Welcome',
  description: null,
  subjectTmpl: 'Hi {{firstName}}',
  preheaderTmpl: null,
  htmlSource: '<!doctype html><html><body><p>Hi {{firstName}}</p></body></html>',
  customVars: {},
  activeVersionId: null,
  createdBy: 'admin@example.com',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const baseVersions: EmailTemplateCustomVersionRow[] = [
  {
    id: 'v1',
    templateId: 'tpl-1',
    versionNumber: 1,
    subjectTmpl: 'Hi {{firstName}}',
    preheaderTmpl: null,
    htmlSource: '<!doctype html><html><body><p>v1</p></body></html>',
    customVars: {},
    commitMessage: null,
    createdAt: new Date(),
    createdBy: 'admin@example.com',
  },
];

beforeEach(() => {
  localStorage.clear(); // isolation du brouillon local (P3.4-b)
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ html: '<p>rendered</p>', subject: 'Hi' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
});

describe('TemplateEditor', () => {
  it('renders subject, preheader, source inputs prefilled from template', () => {
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    // Both subject input + source textarea contain the same text — getAll
    expect(
      screen.getAllByDisplayValue(/Hi \{\{firstName\}\}/).length,
    ).toBeGreaterThan(0);
  });

  it('insert-var button inserts {{var}} into source (clé réelle du catalogue)', () => {
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    const btn = screen.getByRole('button', { name: '{{shopUrl}}' });
    fireEvent.click(btn);
    const textareas = screen.getAllByRole('textbox');
    const source = textareas.find((t) => (t as HTMLTextAreaElement).value.includes('{{shopUrl}}'));
    expect(source).toBeTruthy();
  });

  it('F07-C-017 — panneau de variables groupé, clés RÉELLES, sans variable fantôme', () => {
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    expect(screen.getByText('Identité')).toBeInTheDocument();
    expect(screen.getByText('Commerce')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '{{totalSpent}}' })).toBeInTheDocument();
    // Les anciennes variables trompeuses ne sont plus proposées.
    expect(screen.queryByRole('button', { name: '{{lastName}}' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '{{orderTotal}}' })).not.toBeInTheDocument();
  });

  it('disables save button when no changes', () => {
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    const saveBtn = screen.getByRole('button', { name: /Aucun changement/i });
    expect(saveBtn).toBeDisabled();
  });

  it('renders versions list', () => {
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    expect(screen.getByText(/v1/i)).toBeInTheDocument();
  });

  it('shows preview error on bad customVars JSON', async () => {
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    // Open the customVars details
    const detailsSummary = screen.getByText(/Variables custom \(JSON\)/i);
    fireEvent.click(detailsSummary);
    // Find the customVars textarea — it's the one currently with value '{}'
    const textareas = screen.getAllByRole('textbox');
    const varsTa = textareas.find(
      (t) => (t as HTMLTextAreaElement).value.trim() === '{}',
    ) as HTMLTextAreaElement;
    fireEvent.change(varsTa, { target: { value: 'not json' } });
    // Wait for debounce
    await new Promise((r) => setTimeout(r, 800));
    expect(screen.getByText(/customVars JSON invalide/i)).toBeInTheDocument();
  });
});
