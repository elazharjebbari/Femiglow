// @vitest-environment jsdom
/**
 * F07 P3.4-e (Lot 2) — autocomplete `{{` câblé dans TemplateEditor.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TemplateEditor } from '../TemplateEditor';
import type { EmailTemplateCustomRow } from '@/lib/db/schema-emails';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const template: EmailTemplateCustomRow = {
  id: 'tpl-1',
  slug: 'welcome',
  name: 'Welcome',
  description: null,
  subjectTmpl: 'Bonjour',
  preheaderTmpl: null,
  htmlSource: '<p>corps</p>',
  customVars: {},
  activeVersionId: null,
  createdBy: 'a@b.co',
  createdAt: new Date('2026-06-01T10:00:00Z'),
  updatedAt: new Date('2026-06-01T10:00:00Z'),
  deletedAt: null,
};

/** La source est la SEULE <textarea> visible (customVars est dans un <details> fermé). */
function source(): HTMLTextAreaElement {
  return screen
    .getAllByRole('textbox')
    .find((t) => t.tagName === 'TEXTAREA') as HTMLTextAreaElement;
}
function type(value: string, cursor: number) {
  const el = source();
  fireEvent.change(el, { target: { value } });
  el.setSelectionRange(cursor, cursor);
  fireEvent.keyUp(el, { key: 'a' });
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ html: '<p>x</p>', subject: 'S' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
});
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('F07 — TemplateEditor autocomplete {{', () => {
  it('F07-C-018 — taper « {{fir » ouvre la liste filtrée (firstName, pas fullName)', async () => {
    render(<TemplateEditor template={template} versions={[]} />);
    type('<p>{{fir', 8);
    const list = await screen.findByTestId('merge-autocomplete');
    expect(within(list).getByText('{{firstName}}')).toBeInTheDocument();
    expect(within(list).queryByText('{{fullName}}')).not.toBeInTheDocument();
  });

  it('F07-C-019 — clic sur une suggestion insère le jeton complet et ferme la liste', async () => {
    render(<TemplateEditor template={template} versions={[]} />);
    type('<p>{{fir', 8);
    const list = await screen.findByTestId('merge-autocomplete');
    fireEvent.mouseDown(within(list).getByText('{{firstName}}'));
    expect(source().value).toContain('{{firstName}}');
    expect(screen.queryByTestId('merge-autocomplete')).not.toBeInTheDocument();
  });

  it('F07-C-020 — Échap ferme la liste', async () => {
    render(<TemplateEditor template={template} versions={[]} />);
    type('<p>{{fir', 8);
    await screen.findByTestId('merge-autocomplete');
    fireEvent.keyDown(source(), { key: 'Escape' });
    expect(screen.queryByTestId('merge-autocomplete')).not.toBeInTheDocument();
  });

  it('F07-C-021 — ↓ puis Entrée choisit la 2e suggestion', async () => {
    render(<TemplateEditor template={template} versions={[]} />);
    type('{{url', 5); // matche unsubscribeUrl, shopUrl, accountUrl, siteUrl
    await screen.findByTestId('merge-autocomplete');
    fireEvent.keyDown(source(), { key: 'ArrowDown' });
    fireEvent.keyDown(source(), { key: 'Enter' });
    expect(source().value).toContain('{{shopUrl}}'); // 2e de la liste
  });
});
