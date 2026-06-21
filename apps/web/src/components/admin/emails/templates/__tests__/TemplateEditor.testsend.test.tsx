// @vitest-environment jsdom
/**
 * F07 P3.4-h (Lot 4) — UI test-send de l'éditeur : champ destinataire prérempli,
 * POST /test-send, feedback succès/erreur.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

function mockFetch(testSendStatus = 200, testSendBody: unknown = { status: 'queued', outboxId: 'o1' }) {
  global.fetch = vi.fn((url: unknown) =>
    Promise.resolve(
      String(url).includes('/test-send')
        ? new Response(JSON.stringify(testSendBody), {
            status: testSendStatus,
            headers: { 'content-type': 'application/json' },
          })
        : new Response(JSON.stringify({ html: '<p>x</p>', subject: 'S' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
    ),
  ) as unknown as typeof fetch;
}
function fetchCalls() {
  return (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
}

beforeEach(() => {
  localStorage.clear();
  mockFetch();
});
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('F07 — TemplateEditor test-send (UI)', () => {
  it('F07-C-023 — destinataire prérempli ; envoi → POST /test-send + feedback succès', async () => {
    render(<TemplateEditor template={template} versions={[]} adminEmail="nadia@femiglow-maroc.com" />);
    expect(screen.getByLabelText('Adresse e-mail du test')).toHaveValue('nadia@femiglow-maroc.com');
    fireEvent.click(screen.getByRole('button', { name: /Envoyer un test/i }));
    expect(await screen.findByText(/Épreuve mise en file/i)).toBeInTheDocument();
    const call = fetchCalls().find((c) => String(c[0]).includes('/test-send'));
    expect(call).toBeTruthy();
    expect(JSON.parse((call![1] as { body: string }).body)).toMatchObject({
      recipient: 'nadia@femiglow-maroc.com',
    });
  });

  it('F07-C-024 — réponse erreur (429) → feedback erreur affiché', async () => {
    mockFetch(429, { error: "Trop d'envois de test (max 10/min)." });
    render(<TemplateEditor template={template} versions={[]} adminEmail="nadia@femiglow-maroc.com" />);
    fireEvent.click(screen.getByRole('button', { name: /Envoyer un test/i }));
    expect(await screen.findByText(/Trop d'envois de test/i)).toBeInTheDocument();
  });

  it('F07-C-025 — destinataire vide → bouton désactivé', () => {
    render(<TemplateEditor template={template} versions={[]} adminEmail="" />);
    expect(screen.getByRole('button', { name: /Envoyer un test/i })).toBeDisabled();
  });
});
